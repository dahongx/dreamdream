"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import {
  characters,
  chatSessions,
  currencyTransactions,
  inviteCodeRedemptions,
  inviteCodes,
  messages,
  modelPrices,
  type UserRole,
  users,
} from "@/lib/db/schema";

/**
 * /admin 「充值」tab 专用 server actions。
 *
 * 三个能力：
 *   1. searchUsersForRecharge(query) —— 按邮箱 / username / displayName / name
 *      模糊匹配，返回最多 10 条候选；前端拿来填下拉。
 *   2. getUserRechargeView(userId) —— 单人详情：账号 / 角色 / 金银币余额 /
 *      （内测人员）当日剩余次数 / 历史流水（含模型 display_name）。
 *   3. rechargeGoldAction —— 给指定用户加金币，写一条 transaction_type=
 *      'recharge' 的流水（amount 为正）。
 *
 * 所有入口都先 ensureAdmin —— 普通用户即便构造 server action 调用也拿不到
 * 数据 / 改不了余额。
 */

const DAILY_LIMIT_REGULAR = 10;
const DAILY_LIMIT_BETA_FALLBACK = 200;

export interface UserSearchResult {
  id: string;
  username: string;
  email: string | null;
  goldBalance: number;
  silverBalance: number;
  role: UserRole;
}

export interface DailyQuotaInfo {
  // 仅 beta_tester 用得到的「内测人员当日剩余次数」语义；admin / regular 也返回，
  // 让 UI 始终能展示，不用区分 schema。
  role: UserRole;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
}

// 流水里"在做什么"的归一化分类 —— 同一字段统一描述「这条变动是哪种业务
// 触发的」，方便 UI 渲染一列「场景」。
//
//   chat        聊天扣费                  (note 起始为「聊天」)
//   continue    续写扣费                  (note 起始为「续写」)
//   embellish   美化包生成                (note 起始为「美化包」)
//   image       图片生成                  (note 起始为「图片生成」)
//   refund      上述任一场景的退款       (note 起始为「退款」)
//   recharge    管理员充值
//   daily_claim 每日登录领取
//   other       兜底（早期数据 / 新业务尚未归类）
export type LedgerScenario =
  | "chat"
  | "continue"
  | "embellish"
  | "image"
  | "refund"
  | "recharge"
  | "daily_claim"
  | "other";

export interface RechargeLedgerEntry {
  id: string;
  createdAt: string; // ISO
  transactionType: "daily_claim" | "recharge" | "model_usage";
  // 归一化的场景（chat / continue / embellish / image / refund / ...）。
  scenario: LedgerScenario;
  // 人类可读的事项 —— 例如「聊天 - 角色名」「美化包 - 替换 HTML」「充值（管理员备注）」
  description: string;
  model: string | null;
  // 「渠道 / 操作员」语义：
  //   - recharge → 触发充值的 admin email（找不到则展示「（账号已注销）」）
  //   - daily_claim → 「每日登录」
  //   - model_usage → null（场景里已经标了哪种业务，不再重复填）
  operatorEmail: string | null;
  goldAmount: number;
  silverAmount: number;
  goldBalanceAfter: number | null;
  silverBalanceAfter: number | null;
  // 模型实际成本（millicents），方便管理员核对单次扣费对应的真实开销。
  costCnyMillicents: number | null;
}

export interface UserRechargeView {
  user: {
    id: string;
    username: string;
    email: string | null;
    role: UserRole;
    goldBalance: number;
    silverBalance: number;
  };
  quota: DailyQuotaInfo;
  ledger: RechargeLedgerEntry[];
}

async function ensureAdmin(): Promise<string | null> {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return null;
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return me?.role === "admin" ? userId : null;
}

function displayUsername(row: {
  displayName: string | null;
  username: string | null;
  name: string | null;
  email: string | null;
}): string {
  return (
    row.displayName?.trim() ||
    row.username?.trim() ||
    row.name?.trim() ||
    row.email?.split("@")[0] ||
    "—"
  );
}

/**
 * 模糊搜索：邮箱 / username / display_name / name 任一命中即返回。
 * 上限 10 条，避免 admin 输入过宽（如 "a"）时把整张表拉回前端。
 */
export async function searchUsersForRecharge(
  query: string,
): Promise<UserSearchResult[]> {
  const adminId = await ensureAdmin();
  if (!adminId) return [];

  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const pattern = `%${trimmed}%`;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      name: users.name,
      email: users.email,
      goldBalance: users.goldBalance,
      silverBalance: users.silverBalance,
      role: users.role,
    })
    .from(users)
    .where(
      or(
        ilike(users.email, pattern),
        ilike(users.username, pattern),
        ilike(users.displayName, pattern),
        ilike(users.name, pattern),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(10);

  return rows.map((r) => ({
    id: r.id,
    username: displayUsername(r),
    email: r.email,
    goldBalance: r.goldBalance,
    silverBalance: r.silverBalance,
    role: r.role,
  }));
}

/**
 * 复用 quota/check.ts 的语义：
 *   - admin → 无上限（这里展示成 ∞，前端兜底成 "—"）
 *   - beta_tester → 取该用户已激活的最大 inviteCodes.dailyLimit；激活码全部
 *     过期会被 quota/check.ts 在第一次调用时降级，本函数不主动改库，
 *     只算"如果当前角色生效是什么状态"。
 *   - regular → 10
 *
 * 已用次数：当 usageDate = 今日 时用 dailyUsageCount，否则按 0 计（次日清零）。
 */
async function buildQuotaInfo(userId: string): Promise<DailyQuotaInfo> {
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select({
      role: users.role,
      dailyUsageCount: users.dailyUsageCount,
      usageDate: users.usageDate,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) {
    return {
      role: "regular",
      dailyLimit: 0,
      usedToday: 0,
      remaining: 0,
    };
  }

  let dailyLimit: number;
  if (row.role === "admin") {
    dailyLimit = Number.POSITIVE_INFINITY;
  } else if (row.role === "beta_tester") {
    const [maxRow] = await db
      .select({
        maxDailyLimit: sql<number | null>`MAX(${inviteCodes.dailyLimit})`,
      })
      .from(inviteCodeRedemptions)
      .innerJoin(inviteCodes, eq(inviteCodeRedemptions.codeId, inviteCodes.id))
      .where(
        and(
          eq(inviteCodeRedemptions.userId, userId),
          or(
            sql`${inviteCodes.expiresAt} IS NULL`,
            sql`${inviteCodes.expiresAt} > NOW()`,
          ),
        ),
      );
    dailyLimit = maxRow?.maxDailyLimit ?? DAILY_LIMIT_BETA_FALLBACK;
  } else {
    dailyLimit = DAILY_LIMIT_REGULAR;
  }

  const usedToday = row.usageDate === today ? row.dailyUsageCount : 0;
  const remaining = Number.isFinite(dailyLimit)
    ? Math.max(0, dailyLimit - usedToday)
    : Number.POSITIVE_INFINITY;

  return {
    role: row.role,
    dailyLimit,
    usedToday,
    remaining,
  };
}

// buildLedger 内部用：在分组阶段临时带 sessionId，反推完后剥掉。
// 不出口到模块外，避免污染 RechargeLedgerEntry 公共契约。
type EntryWithSession = RechargeLedgerEntry & { _sessionId: string | null };

// note 起始词 → 归一化场景。所有写入侧入口（chat / continue / generate /
// images）都用固定的中文前缀（参见 src/app/api/*）；这里集中解析，避免每个
// UI 自己拼字符串识别。
function classifyModelUsageScenario(note: string | null): LedgerScenario {
  if (!note) return "other";
  if (note.startsWith("退款")) return "refund";
  if (note.startsWith("聊天")) return "chat";
  if (note.startsWith("续写")) return "continue";
  if (note.startsWith("美化包")) return "embellish";
  if (note.startsWith("图片生成")) return "image";
  return "other";
}

/**
 * 取该用户的流水（最近 200 条）。布局上和 ProfileTabs 走同样的「同时刻金+银
 * 合并」语义，并多带 costCnyMillicents 一列让 admin 直接看到模型成本。
 *
 * 多带两列结构化信息：
 *   - scenario   归一化场景（chat / embellish / recharge / ...），UI 直接渲染
 *   - operator   recharge 时关联到执行充值的 admin（email），daily_claim 写
 *                「每日登录」字面值。alias users 表两次（一次拿 ledger 主体的
 *                user，一次拿 operator），用 drizzle alias 避免列名歧义。
 */
async function buildLedger(userId: string): Promise<RechargeLedgerEntry[]> {
  // 同 wallet/queries.ts：流水自己冗余的 sessionId 优先，messageId 回退。
  const sessionIdCoalesced = sql<
    string | null
  >`COALESCE(${currencyTransactions.sessionId}, ${messages.sessionId})`;
  // operator alias：currency_transactions.operator_id → users.email。
  const operator = alias(users, "operator");

  const rows = await db
    .select({
      id: currencyTransactions.id,
      createdAt: currencyTransactions.createdAt,
      transactionType: currencyTransactions.transactionType,
      currencyType: currencyTransactions.currencyType,
      amount: currencyTransactions.amount,
      balanceAfter: currencyTransactions.balanceAfter,
      note: currencyTransactions.note,
      messageId: currencyTransactions.messageId,
      // sessionId 用来做 refund→deduct 配对（同 session 内最近一条非退款行的
      // cost 反推到当前退款行）。COALESCE 用的列名见 sessionIdCoalesced。
      sessionId: sessionIdCoalesced,
      modelId: currencyTransactions.modelId,
      operatorId: currencyTransactions.operatorId,
      operatorEmail: operator.email,
      operatorDisplayName: operator.displayName,
      operatorName: operator.name,
      modelDisplayName: modelPrices.displayName,
      characterName: characters.name,
      // 单一来源：流水自己结算时写的 cost snapshot（migration 0031 起所有
      // 路径都会有；0032 已把单次归属可判定的老数据回填）。
      //
      // 不再 JOIN messages.cost_cny_millicents——messages 的 cost 是「这条
      // assistant 消息从首次聊天到所有续写的累计成本」，对账本「单次调用
      // 成本」语义不对，会把同 messageId 下 N 条流水都显示成累计值（看着
      // 像被算了 N+1 次）。老数据里不可判定的多轮 case 现在显示「—」。
      txCostCnyMillicents: currencyTransactions.costCnyMillicents,
    })
    .from(currencyTransactions)
    .leftJoin(messages, eq(messages.id, currencyTransactions.messageId))
    .leftJoin(chatSessions, eq(chatSessions.id, sessionIdCoalesced))
    .leftJoin(characters, eq(characters.id, chatSessions.characterId))
    .leftJoin(
      modelPrices,
      eq(modelPrices.modelId, currencyTransactions.modelId),
    )
    .leftJoin(operator, eq(operator.id, currencyTransactions.operatorId))
    .where(eq(currencyTransactions.userId, userId))
    .orderBy(desc(currencyTransactions.createdAt))
    .limit(200);

  const grouped = new Map<string, RechargeLedgerEntry>();

  for (const row of rows) {
    const key = `${row.createdAt.toISOString()}-${row.transactionType}-${row.messageId || ""}`;

    // ─── 推 scenario ───
    let scenario: LedgerScenario;
    if (row.transactionType === "daily_claim") {
      scenario = "daily_claim";
    } else if (row.transactionType === "recharge") {
      scenario = "recharge";
    } else {
      scenario = classifyModelUsageScenario(row.note);
    }

    // ─── 推 description ───
    let description = "";
    if (row.transactionType === "daily_claim") {
      description = "每日签到";
    } else if (row.transactionType === "recharge") {
      description = row.note ? `充值 - ${row.note}` : "充值";
    } else if (row.transactionType === "model_usage") {
      if (row.note && row.characterName) {
        description = `${row.note} - ${row.characterName}`;
      } else if (row.note) {
        description = row.note;
      } else if (row.characterName) {
        description = `聊天 - ${row.characterName}`;
      } else {
        description = "模型调用";
      }
    } else {
      description = row.note || row.transactionType;
    }

    // ─── 推 operatorEmail（一列「渠道 / 操作员」） ───
    let operatorEmail: string | null;
    if (row.transactionType === "daily_claim") {
      operatorEmail = "每日登录";
    } else if (row.transactionType === "recharge") {
      // 优先 email；非常老的 OAuth 账号可能 email 为空，退回 displayName/name；
      // 都没有但 operator_id 仍在 → 用截断后的 UUID；连 operator_id 都丢了
      // （旧数据 / admin 账号已注销）→ 兜底「（账号已注销）」让 UI 别露 null。
      operatorEmail =
        row.operatorEmail ??
        row.operatorDisplayName ??
        row.operatorName ??
        (row.operatorId ? `${row.operatorId.slice(0, 8)}…` : "（账号已注销）");
    } else {
      operatorEmail = null;
    }

    const model = row.modelDisplayName ?? row.modelId ?? null;
    // 仅读流水自己（0031 起所有路径都会 settle；0032 已回填可判定的老数据）。
    // 不可回填的多轮老 case → NULL → 留给下面的 refund 反推或最终展示「—」。
    const cost = row.txCostCnyMillicents ?? null;

    // 中转字段：retain sessionId on entry 以便 refund 反推时 lookup。
    // 暂存在 _sessionId 上不暴露给类型外部，post-pass 完后丢弃。
    const sessionIdForRow = row.sessionId;

    const existing = grouped.get(key);
    if (existing) {
      if (row.currencyType === "gold") {
        existing.goldAmount = row.amount;
        existing.goldBalanceAfter = row.balanceAfter;
      } else {
        existing.silverAmount = row.amount;
        existing.silverBalanceAfter = row.balanceAfter;
      }
      if (existing.model == null && model != null) existing.model = model;
      if (existing.costCnyMillicents == null && cost != null) {
        existing.costCnyMillicents = cost;
      }
      if (
        (existing as EntryWithSession)._sessionId == null &&
        sessionIdForRow != null
      ) {
        (existing as EntryWithSession)._sessionId = sessionIdForRow;
      }
    } else {
      const entry: EntryWithSession = {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        transactionType: row.transactionType,
        scenario,
        description,
        model,
        operatorEmail,
        goldAmount: row.currencyType === "gold" ? row.amount : 0,
        silverAmount: row.currencyType === "silver" ? row.amount : 0,
        goldBalanceAfter: row.currencyType === "gold" ? row.balanceAfter : null,
        silverBalanceAfter:
          row.currencyType === "silver" ? row.balanceAfter : null,
        costCnyMillicents: cost,
        _sessionId: sessionIdForRow,
      };
      grouped.set(key, entry);
    }
  }

  const entries = Array.from(grouped.values()) as EntryWithSession[];

  // ─── 退款行 cost 反推 ───────────────────────────────────────────────
  // 退款本身没有 cost（refund 不调 settle，因为退款发生时这条调用就是失败
  // 的，模型未必产生 token）。但对账本读者来说，看到「退款 - 流式异常」
  // 一行裸的 cost = NULL 很难定位「这次退的是哪笔的钱」。
  //
  // 反推规则：在同一 sessionId 内，找紧邻这条退款之前（时间更早）的最近一条
  // 非 refund 的 model_usage 行，如果它有 cost 就抄过来。这正确处理「同次
  // 调用扣费 + 立刻退款」的最常见 case（聊天安全策略命中 / 续写空响应 / 美化
  // 包流式错误等），不会跨 session 串味。
  //
  // entries 是按 createdAt DESC 排列的（SQL 给的顺序），所以「紧邻之前」=
  // 数组里更靠后的下一个匹配项。
  const N = entries.length;
  for (let i = 0; i < N; i++) {
    const cur = entries[i];
    if (cur.scenario !== "refund") continue;
    if (cur.costCnyMillicents != null) continue;
    if (!cur._sessionId) continue;
    for (let j = i + 1; j < N; j++) {
      const cand = entries[j];
      if (cand._sessionId !== cur._sessionId) continue;
      if (cand.transactionType !== "model_usage") continue;
      if (cand.scenario === "refund") continue;
      if (cand.costCnyMillicents == null) continue;
      cur.costCnyMillicents = cand.costCnyMillicents;
      break;
    }
  }

  // 去掉内部字段再返回（结构上 entries 仍然带着 _sessionId，但类型签名约束
  // 调用方只能看到 RechargeLedgerEntry —— 解构 + spread 剥掉这个字段）。
  return entries.map(({ _sessionId, ...rest }) => {
    void _sessionId;
    return rest;
  });
}

export async function getUserRechargeView(
  userId: string,
): Promise<UserRechargeView | null> {
  const adminId = await ensureAdmin();
  if (!adminId) return null;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      name: users.name,
      role: users.role,
      goldBalance: users.goldBalance,
      silverBalance: users.silverBalance,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const [quota, ledger] = await Promise.all([
    buildQuotaInfo(userId),
    buildLedger(userId),
  ]);

  return {
    user: {
      id: user.id,
      username: displayUsername(user),
      email: user.email,
      role: user.role,
      goldBalance: user.goldBalance,
      silverBalance: user.silverBalance,
    },
    quota,
    ledger,
  };
}

// 充值上限 1 千万金币 —— 卡个肉眼可见的天花板，防止误输入 e.g. 多按一个 0。
const rechargeSchema = z.object({
  userId: z.string().uuid("用户 ID 非法"),
  amount: z.coerce
    .number()
    .int("必须是整数")
    .min(1, "金额必须大于 0")
    .max(10_000_000, "单次最多 10000000 金币"),
  note: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().max(200, "备注最多 200 字").nullable(),
    )
    .optional(),
});

export type RechargeResult =
  | {
      ok: true;
      amount: number;
      newGoldBalance: number;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * 给指定用户充值金币（仅金币，按需求；银币暂不开充值口）。
 * 写一条 currency_transactions(transaction_type='recharge', currency_type='gold')，
 * 同时 UPDATE users.gold_balance。包在 transaction 里避免半成功状态。
 *
 * 调用方传 prevState（useActionState 接口），返回 RechargeResult；前端拿
 * 到 ok=true 后自己 refetch view，不依赖 revalidatePath。但 /admin 整页
 * 仍走一遍 revalidate 让其他 tab 的统计也吃到新数据。
 */
export async function rechargeGoldAction(
  _prev: RechargeResult | null,
  formData: FormData,
): Promise<RechargeResult> {
  const adminId = await ensureAdmin();
  if (!adminId) {
    return { ok: false, error: "Forbidden" };
  }

  const parsed = rechargeSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "表单校验失败",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const { userId, amount, note } = parsed.data;

  // operator_id 已结构化记录操作者；note 现在仅保存 admin 自填的备注（"补偿"
  // /"商务赠送"等），不再混入 "by xxx@..." —— ledger 渲染时 JOIN 出 operator
  // 用户的 email 来展示，避免靠字符串拼接传递结构化信息。
  const newBalance = await db
    .transaction(async (tx) => {
      const [target] = await tx
        .select({ goldBalance: users.goldBalance })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!target) {
        throw new Error("用户不存在");
      }

      const updatedBalance = target.goldBalance + amount;
      await tx
        .update(users)
        .set({ goldBalance: updatedBalance })
        .where(eq(users.id, userId));

      await tx.insert(currencyTransactions).values({
        userId,
        transactionType: "recharge",
        currencyType: "gold",
        amount,
        balanceAfter: updatedBalance,
        operatorId: adminId,
        note: note ?? null,
      });

      return updatedBalance;
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "充值失败";
      return { __error: msg } as const;
    });

  if (
    typeof newBalance === "object" &&
    newBalance !== null &&
    "__error" in newBalance
  ) {
    return { ok: false, error: newBalance.__error };
  }

  revalidatePath("/admin");
  return { ok: true, amount, newGoldBalance: newBalance as number };
}
