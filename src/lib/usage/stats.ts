import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { messages } from "@/lib/db/schema";

export interface UsageAggregate {
  messageCount: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCostMillicents: number;
  // CNY snapshot summed from messages.cost_cny_millicents (frozen at write
  // time per the rate that was active then). Pre-feature rows are
  // backfilled to USD × 7.2 by migration 0020.
  totalCostCnyMillicents: number;
}

export interface ModelUsageRow {
  model: string;
  messageCount: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costMillicents: number;
  costCnyMillicents: number;
}

export interface AdminUsageStats {
  today: UsageAggregate;
  week: UsageAggregate;
  month: UsageAggregate;
  byModel: ModelUsageRow[];
}

export interface DailyModelUsage {
  // 7 个 YYYY-MM-DD（按 Asia/Shanghai 切日），最早 → 最新
  days: string[];
  // 出现在窗口内的 model id，按窗口总成本降序
  models: string[];
  // model -> 每日 count，长度与 days 对齐；缺失日补 0
  callCounts: Record<string, number[]>;
  // model -> 每日 CNY millicents，长度与 days 对齐；缺失日补 0
  costCnyMillicents: Record<string, number[]>;
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const emptyAggregate: UsageAggregate = {
  messageCount: 0,
  tokensIn: 0,
  tokensOut: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalCostMillicents: 0,
  totalCostCnyMillicents: 0,
};

async function aggregateSince(since: Date): Promise<UsageAggregate> {
  const [row] = await db
    .select({
      messageCount: sql<number>`count(*)::int`,
      tokensIn: sql<number>`coalesce(sum(${messages.tokensIn}), 0)::int`,
      tokensOut: sql<number>`coalesce(sum(${messages.tokensOut}), 0)::int`,
      cacheReadTokens: sql<number>`coalesce(sum(${messages.cacheReadTokens}), 0)::int`,
      cacheWriteTokens: sql<number>`coalesce(sum(${messages.cacheWriteTokens}), 0)::int`,
      totalCostMillicents: sql<number>`coalesce(sum(${messages.costMillicents}), 0)::int`,
      totalCostCnyMillicents: sql<number>`coalesce(sum(${messages.costCnyMillicents}), 0)::int`,
    })
    .from(messages)
    .where(and(eq(messages.role, "assistant"), gte(messages.createdAt, since)));
  return row ?? emptyAggregate;
}

async function aggregateByModel(): Promise<ModelUsageRow[]> {
  const since = startOfMonth();
  const rows = await db
    .select({
      model: messages.model,
      messageCount: sql<number>`count(*)::int`,
      tokensIn: sql<number>`coalesce(sum(${messages.tokensIn}), 0)::int`,
      tokensOut: sql<number>`coalesce(sum(${messages.tokensOut}), 0)::int`,
      cacheReadTokens: sql<number>`coalesce(sum(${messages.cacheReadTokens}), 0)::int`,
      cacheWriteTokens: sql<number>`coalesce(sum(${messages.cacheWriteTokens}), 0)::int`,
      costMillicents: sql<number>`coalesce(sum(${messages.costMillicents}), 0)::int`,
      costCnyMillicents: sql<number>`coalesce(sum(${messages.costCnyMillicents}), 0)::int`,
    })
    .from(messages)
    // 过滤掉 model IS NULL 的行：那是 sessions/queries.ts 在新建会话时
    // 把角色卡 `opening` 静态插入的 assistant 消息，不调 AI、无 tokens / cost，
    // 在"按模型统计"里展示成 "unknown" 是噪声。三个 aggregateSince 总账不动
    // —— 它们 sum(cost_millicents) 时 NULL 本来就 coalesce 成 0。
    .where(
      and(
        eq(messages.role, "assistant"),
        gte(messages.createdAt, since),
        isNotNull(messages.model),
      ),
    )
    .groupBy(messages.model)
    .orderBy(sql`sum(${messages.costMillicents}) desc nulls last`);

  return rows.map((r) => ({ ...r, model: r.model ?? "unknown" }));
}

export async function getAdminUsageStats(): Promise<AdminUsageStats> {
  const [today, week, month, byModel] = await Promise.all([
    aggregateSince(startOfDay()),
    aggregateSince(startOfWeek()),
    aggregateSince(startOfMonth()),
    aggregateByModel(),
  ]);
  return { today, week, month, byModel };
}

// 解析 "YYYY-MM-DD" 为该日在 Asia/Shanghai 的 00:00 对应的 UTC 时刻。
// 中国标准时间无 DST，固定 +08:00，所以这里直接拼 ISO 串即可。
export function shanghaiMidnightUTC(yyyymmdd: string): Date {
  return new Date(`${yyyymmdd}T00:00:00+08:00`);
}

// 返回 Asia/Shanghai 时区下的 YYYY-MM-DD。en-CA locale 天然就是 ISO 格式。
function formatShanghaiDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

export function todayInShanghai(): string {
  return formatShanghaiDay(new Date());
}

export function shiftDay(yyyymmdd: string, deltaDays: number): string {
  const d = shanghaiMidnightUTC(yyyymmdd);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatShanghaiDay(d);
}

/**
 * 拉取 [endDate-windowDays+1, endDate] 这个滑动窗口内、按 Asia/Shanghai
 * 切日的每模型调用次数。endDate 是 YYYY-MM-DD（Shanghai 时区）。
 *
 * 与 aggregateByModel 一致：只数 role='assistant' 且 model NOT NULL 的行
 * （滤掉静态插入的 opening 噪声）。
 */
export async function getDailyModelUsage(
  endDate: string = todayInShanghai(),
  windowDays = 7,
): Promise<DailyModelUsage> {
  const startDateStr = shiftDay(endDate, -(windowDays - 1));
  const startUTC = shanghaiMidnightUTC(startDateStr);
  const endExclusiveUTC = shanghaiMidnightUTC(shiftDay(endDate, 1));

  // DAY_TZ 是写死常量，不走参数绑定，避免 PG 对 `AT TIME ZONE $1` 推类型时的歧义。
  const dayExpr = sql<string>`to_char(${messages.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      day: dayExpr,
      model: messages.model,
      count: sql<number>`count(*)::int`,
      costCnyMillicents: sql<number>`coalesce(sum(${messages.costCnyMillicents}), 0)::int`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.role, "assistant"),
        isNotNull(messages.model),
        gte(messages.createdAt, startUTC),
        // 用 drizzle 的 lt() 而不是 sql\`< ${date}\`：sql 模板里的 Date
        // 不会被识别为 timestamptz，postgres.js 在序列化时会抛
        // ERR_INVALID_ARG_TYPE。
        lt(messages.createdAt, endExclusiveUTC),
      ),
    )
    .groupBy(dayExpr, messages.model);

  const days: string[] = [];
  for (let i = 0; i < windowDays; i++) {
    days.push(shiftDay(startDateStr, i));
  }

  const callsMap = new Map<string, number[]>();
  const costMap = new Map<string, number[]>();
  for (const row of rows) {
    const model = row.model ?? "unknown";
    if (!callsMap.has(model)) {
      callsMap.set(model, new Array(windowDays).fill(0));
      costMap.set(model, new Array(windowDays).fill(0));
    }
    const idx = days.indexOf(row.day);
    if (idx >= 0) {
      const callsArr = callsMap.get(model);
      const costArr = costMap.get(model);
      if (callsArr) callsArr[idx] = row.count;
      if (costArr) costArr[idx] = row.costCnyMillicents;
    }
  }

  // 按窗口总成本降序排（与 aggregateByModel 表格的排序口径保持一致）。
  const models = Array.from(callsMap.keys()).sort((a, b) => {
    const costA = (costMap.get(a) ?? []).reduce((s, x) => s + x, 0);
    const costB = (costMap.get(b) ?? []).reduce((s, x) => s + x, 0);
    return costB - costA;
  });

  const callCounts: Record<string, number[]> = {};
  const costCnyMillicents: Record<string, number[]> = {};
  for (const m of models) {
    const c = callsMap.get(m);
    const k = costMap.get(m);
    if (c) callCounts[m] = c;
    if (k) costCnyMillicents[m] = k;
  }

  return { days, models, callCounts, costCnyMillicents };
}
