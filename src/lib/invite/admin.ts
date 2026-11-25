"use server";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import {
  chatSessions,
  inviteCodeRedemptions,
  inviteCodes,
  messages,
  users,
} from "@/lib/db/schema";

export type GenerateResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export async function generateInviteCodeAction(
  _prev: GenerateResult | null,
  formData: FormData,
): Promise<GenerateResult> {
  const userId = await getCurrentUserId();

  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (me?.role !== "admin") {
    return { ok: false, error: "Forbidden" };
  }

  const expiresInDays = Number(formData.get("expiresInDays")) || 7;
  const maxUses = Number(formData.get("maxUses")) || 1;
  const dailyLimit = Math.max(1, Number(formData.get("dailyLimit")) || 200);

  const code = nanoid(8).toUpperCase();
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

  await db.insert(inviteCodes).values({
    code,
    createdBy: userId,
    maxUses,
    dailyLimit,
    expiresAt,
  });

  revalidatePath("/settings");
  return { ok: true, code };
}

export interface InviteCodeItem {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  dailyLimit: number;
  expiresAt: string | null;
  createdAt: string;
  redemptions: Array<{
    userEmail: string | null;
    redeemedAt: string;
  }>;
  // 该激活码绑定的所有用户合计真实调用模型的 assistant 消息条数。
  // 与 daily quota 的 dailyUsageCount 不是同一口径 —— 那个按"用户每日轮次"
  // 计；这里直接数 messages 表里 role='assistant' 且 model NOT NULL（过滤掉
  // 角色卡 opening 静态插入）的消息总数，回看每个码绑定用户的全部历史。
  apiCallCount: number;
  // 累计模型成本（CNY millicents 快照口径，与 admin usage 表一致）。
  totalCostCnyMillicents: number;
}

export async function listInviteCodes(): Promise<InviteCodeItem[]> {
  const userId = await getCurrentUserId();

  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (me?.role !== "admin") return [];

  const codes = await db
    .select()
    .from(inviteCodes)
    .orderBy(desc(inviteCodes.createdAt));

  if (codes.length === 0) return [];

  const redemptions = await db
    .select({
      codeId: inviteCodeRedemptions.codeId,
      redeemedAt: inviteCodeRedemptions.redeemedAt,
      userEmail: users.email,
    })
    .from(inviteCodeRedemptions)
    .leftJoin(users, eq(inviteCodeRedemptions.userId, users.id));

  const redemptionMap = new Map<
    string,
    Array<{ userEmail: string | null; redeemedAt: string }>
  >();
  for (const r of redemptions) {
    const list = redemptionMap.get(r.codeId) ?? [];
    list.push({
      userEmail: r.userEmail,
      redeemedAt: r.redeemedAt.toISOString(),
    });
    redemptionMap.set(r.codeId, list);
  }

  // 为每个 (codeId, userId) 组合算「该用户在 messages 表里有多少条真实模型
  // 调用 + 累计 CNY 成本」，再按 codeId 汇总。一个用户即使被多个码绑定，
  // 在每个码下都算自己的全量历史 —— 与"绑定关系反向回看"语义一致。
  //
  // 实现走单条 SQL：redemptions ⋈ chat_sessions(by user) ⋈ messages，
  // 一次性 group by codeId。避免 redemptionsCount × messagesCount 的应用层扇出。
  const usageMap = new Map<
    string,
    { apiCallCount: number; totalCostCnyMillicents: number }
  >();
  const codeIds = codes.map((c) => c.id);
  if (codeIds.length > 0) {
    const usageRows = await db
      .select({
        codeId: inviteCodeRedemptions.codeId,
        apiCallCount: sql<number>`count(${messages.id})::int`,
        totalCostCnyMillicents: sql<number>`coalesce(sum(${messages.costCnyMillicents}), 0)::int`,
      })
      .from(inviteCodeRedemptions)
      .innerJoin(
        chatSessions,
        eq(chatSessions.userId, inviteCodeRedemptions.userId),
      )
      .innerJoin(
        messages,
        and(
          eq(messages.sessionId, chatSessions.id),
          eq(messages.role, "assistant"),
          // 过滤静态 opening 噪声 —— 与 src/lib/usage/stats.ts 同口径。
          isNotNull(messages.model),
        ),
      )
      .where(inArray(inviteCodeRedemptions.codeId, codeIds))
      .groupBy(inviteCodeRedemptions.codeId);

    for (const row of usageRows) {
      usageMap.set(row.codeId, {
        apiCallCount: row.apiCallCount,
        totalCostCnyMillicents: row.totalCostCnyMillicents,
      });
    }
  }

  return codes.map((c) => {
    const usage = usageMap.get(c.id);
    return {
      id: c.id,
      code: c.code,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      dailyLimit: c.dailyLimit,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      redemptions: redemptionMap.get(c.id) ?? [],
      apiCallCount: usage?.apiCallCount ?? 0,
      totalCostCnyMillicents: usage?.totalCostCnyMillicents ?? 0,
    };
  });
}
