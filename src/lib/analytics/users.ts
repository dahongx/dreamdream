"use server";

import { eq, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import {
  shanghaiMidnightUTC,
  shiftDay,
  todayInShanghai,
} from "@/lib/usage/stats";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface UserAnalyticsRow {
  id: string;
  // 展示口径：优先 displayName → username → email 前缀，最后兜底空串。
  // 与 Shell.tsx 头像 fallback 一致，避免管理员看到一堆 "—"。
  username: string;
  email: string | null;
  createdAt: string;
  // 由 auth.users.last_sign_in_at 直查（Supabase 自带）。null = 注册后从未登录
  // （邮件验证未完成等场景）。
  lastSignInAt: string | null;
  // 全周期 assistant 消息条数（model NOT NULL，过滤 opening 静态插入）。
  totalApiCalls: number;
  // 全周期 CNY 成本（snapshot 口径，与 admin usage 同）。
  totalCostCnyMillicents: number;
  // 最近 7 天（按 Asia/Shanghai 滚动窗口）调用次数。
  lastWeekApiCalls: number;
}

export interface UserDailyUsageRow {
  id: string;
  username: string;
  email: string | null;
  apiCalls: number;
  costCnyMillicents: number;
}

async function ensureAdmin(): Promise<boolean> {
  const userId = await getCurrentUserId();
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return me?.role === "admin";
}

/**
 * 列出所有注册用户 + 各自的全周期 / 最近一周用量统计。
 *
 * 实现策略：单条 SQL，让 PG 做 left join + 分组聚合，避免应用层 N+1。
 * - `auth.users.last_sign_in_at` 是 Supabase Auth 自家字段，跨 schema 直查；
 *   桥接 migration 0011 保证 public.users.id = auth.users.id。
 * - assistant 消息走 `messages ⋈ chat_sessions(by user)`，filter
 *   `role='assistant' AND model IS NOT NULL`（与 src/lib/usage/stats.ts
 *   同口径，过滤角色卡 opening 静态插入噪声）。
 * - 最近一周用 `FILTER (WHERE created_at >= …)` 在同一 group by 里捎带算，
 *   不另开 query。
 *
 * 排序：累计调用次数降序 → 注册时间倒序。让"重度用户"靠前，匿名注册账号
 * 沉到底部。
 */
export async function listUserAnalytics(): Promise<UserAnalyticsRow[]> {
  if (!(await ensureAdmin())) return [];

  // 滚动窗口：[today-6, today] 闭区间，与 getDailyModelUsage 7 日窗口同
  // 语义（end 包含今天，7 个自然日）。
  //
  // 用 ISO 字符串 + `::timestamptz` 在 SQL 内显式 cast，而不是直接传 Date
  // 对象 —— 在裸 `sql\`\`` 模板里 drizzle 没有列上下文推断不出 timestamptz，
  // postgres.js 收到 Date 会抛 ERR_INVALID_ARG_TYPE（参见 b100e37 同类
  // 修复）。这里 cast 帮 postgres.js 锁定类型。
  const today = todayInShanghai();
  const weekStartIso = shanghaiMidnightUTC(shiftDay(today, -6)).toISOString();

  const rows = await db.execute<{
    id: string;
    username: string | null;
    display_name: string | null;
    name: string | null;
    email: string | null;
    created_at: Date;
    last_sign_in_at: Date | null;
    total_api_calls: number;
    total_cost_cny_millicents: number;
    last_week_api_calls: number;
  }>(sql`
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.name,
      u.email,
      u.created_at,
      au.last_sign_in_at,
      COALESCE(COUNT(m.id) FILTER (WHERE m.role = 'assistant' AND m.model IS NOT NULL), 0)::int
        AS total_api_calls,
      COALESCE(SUM(m.cost_cny_millicents) FILTER (WHERE m.role = 'assistant' AND m.model IS NOT NULL), 0)::int
        AS total_cost_cny_millicents,
      COALESCE(
        COUNT(m.id) FILTER (
          WHERE m.role = 'assistant'
            AND m.model IS NOT NULL
            AND m.created_at >= ${weekStartIso}::timestamptz
        ),
        0
      )::int AS last_week_api_calls
    FROM ${users} u
    LEFT JOIN auth.users au ON au.id = u.id
    LEFT JOIN chat_sessions cs ON cs.user_id = u.id
    LEFT JOIN messages m ON m.session_id = cs.id
    GROUP BY u.id, u.username, u.display_name, u.name, u.email, u.created_at, au.last_sign_in_at
    ORDER BY total_api_calls DESC, u.created_at DESC
  `);

  return rows.map((r) => ({
    id: r.id,
    username:
      r.display_name?.trim() ||
      r.username?.trim() ||
      r.name?.trim() ||
      r.email?.split("@")[0] ||
      "—",
    email: r.email,
    createdAt: new Date(r.created_at).toISOString(),
    lastSignInAt: r.last_sign_in_at
      ? new Date(r.last_sign_in_at).toISOString()
      : null,
    totalApiCalls: r.total_api_calls,
    totalCostCnyMillicents: r.total_cost_cny_millicents,
    lastWeekApiCalls: r.last_week_api_calls,
  }));
}

/**
 * 给定 YYYY-MM-DD（Shanghai 时区），返回每个用户当天的 API 调用次数 + 成本。
 * 当天没有任何活动的用户**不返回**（INNER JOIN messages） —— 否则 N 个用户
 * × 0 调用会铺满表格无信息量。
 *
 * 调用方一般绑在 client useTransition 上，切换日期时单独打一次 server
 * action 拉新数据。
 */
export async function getUserDailyUsage(
  date: string,
): Promise<UserDailyUsageRow[]> {
  if (!(await ensureAdmin())) return [];

  if (!DATE_RE.test(date)) {
    throw new Error(`Invalid date: ${date}, expected YYYY-MM-DD`);
  }
  const today = todayInShanghai();
  // 未来日期当作"今天"，避免显示明显空表又给客户端 0 数据迷惑感。
  const effective = date <= today ? date : today;

  // ISO 字符串 + `::timestamptz` cast，避免在 raw `sql\`\`` 里传 Date 触发
  // postgres.js 的 ERR_INVALID_ARG_TYPE（参见 listUserAnalytics 注释）。
  const startIso = shanghaiMidnightUTC(effective).toISOString();
  const endExclusiveIso = shanghaiMidnightUTC(
    shiftDay(effective, 1),
  ).toISOString();

  const rows = await db.execute<{
    id: string;
    username: string | null;
    display_name: string | null;
    name: string | null;
    email: string | null;
    api_calls: number;
    cost_cny_millicents: number;
  }>(sql`
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.name,
      u.email,
      COUNT(m.id)::int AS api_calls,
      COALESCE(SUM(m.cost_cny_millicents), 0)::int AS cost_cny_millicents
    FROM ${users} u
    INNER JOIN chat_sessions cs ON cs.user_id = u.id
    INNER JOIN messages m ON m.session_id = cs.id
    WHERE m.role = 'assistant'
      AND m.model IS NOT NULL
      AND m.created_at >= ${startIso}::timestamptz
      AND m.created_at < ${endExclusiveIso}::timestamptz
    GROUP BY u.id, u.username, u.display_name, u.name, u.email
    ORDER BY api_calls DESC, u.email NULLS LAST
  `);

  return rows.map((r) => ({
    id: r.id,
    username:
      r.display_name?.trim() ||
      r.username?.trim() ||
      r.name?.trim() ||
      r.email?.split("@")[0] ||
      "—",
    email: r.email,
    apiCalls: r.api_calls,
    costCnyMillicents: r.cost_cny_millicents,
  }));
}
