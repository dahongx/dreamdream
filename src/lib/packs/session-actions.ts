"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import {
  beautificationPacks,
  type OpeningComponent,
  openingComponents,
  type RegexRule,
  regexRules,
  type StudioDraftPayload,
  type StudioSession,
  studioSessions,
} from "@/lib/db/schema";
import {
  clearSessionMessages,
  getSessionMessages,
} from "@/lib/packs/assistant-messages";
import { canEditPack } from "@/lib/packs/permissions";
import { getSessionPackOwner } from "@/lib/packs/session-queries";
// writePackUpdates 不做鉴权，故意住在普通模块里 —— 放进本文件会被 Next 注册
// 成公开 server action。详见 write-pack-updates.ts 顶部注释。
import {
  openingDraftSchema,
  ruleDraftSchema,
  writePackUpdates,
} from "@/lib/packs/write-pack-updates";

/**
 * Studio AI session server actions ——「一个 session = 一个产物」 入口。
 *
 * 流程：
 *   create  →  AssistantTab 多轮 chat  →  apply proposal 调 update（写
 *   draftPayload）  →  「确认应用」commit 入库 + 标 committed  /  「丢弃」
 *   只标 discarded，不写库。
 *
 * 旧 commitStudioDraftAction 在 UI 侧被 commitStudioSessionAction 取代。
 */

const draftPayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("css"), css: z.string().max(32_000) }),
  z.object({ kind: z.literal("rule"), rule: ruleDraftSchema }),
  z.object({ kind: z.literal("opening"), opening: openingDraftSchema }),
]);

type Ok<T> = { ok: true } & T;
type Result<T = Record<never, never>> = Ok<T> | { ok: false; error: string };

async function resolveSession(
  sessionId: string,
): Promise<
  | { ok: true; session: StudioSession; userId: string }
  | { ok: false; error: string }
> {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return { ok: false, error: "未登录" };
  }
  const row = await getSessionPackOwner(sessionId);
  if (!row) return { ok: false, error: "找不到这份创作记录" };
  if (row.ownerUserId !== userId) {
    return { ok: false, error: "你没有编辑该美化包的权限" };
  }
  return { ok: true, session: row.session, userId };
}

const createSchema = z.object({
  packId: z.string().uuid(),
  type: z.enum(["css", "component", "opening"]),
  targetRuleId: z.string().uuid().nullable().optional(),
  targetOpeningComponentId: z.string().uuid().nullable().optional(),
});

export async function createStudioSessionAction(
  input: z.input<typeof createSchema>,
): Promise<Result<{ session: StudioSession }>> {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return { ok: false, error: "未登录" };
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "参数格式不合法",
    };
  }
  const { packId, type, targetRuleId, targetOpeningComponentId } = parsed.data;

  const [pack] = await db
    .select()
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, packId))
    .limit(1);
  if (!pack || !canEditPack(pack, userId)) {
    return { ok: false, error: "找不到该美化包，或你没有编辑权限" };
  }

  if (type === "component" && targetRuleId) {
    const [rule] = await db
      .select({ id: regexRules.id })
      .from(regexRules)
      .where(
        and(eq(regexRules.id, targetRuleId), eq(regexRules.packId, packId)),
      )
      .limit(1);
    if (!rule) return { ok: false, error: "要编辑的对话组件不存在" };
  }

  if (type === "opening" && targetOpeningComponentId) {
    const [oc] = await db
      .select({ id: openingComponents.id })
      .from(openingComponents)
      .where(
        and(
          eq(openingComponents.id, targetOpeningComponentId),
          eq(openingComponents.packId, packId),
        ),
      )
      .limit(1);
    if (!oc) return { ok: false, error: "要编辑的开场组件不存在" };
  }

  // auto-discard 已存在的 active session（单 active 约束）
  await db
    .update(studioSessions)
    .set({ status: "discarded", updatedAt: new Date() })
    .where(
      and(
        eq(studioSessions.userId, userId),
        eq(studioSessions.packId, packId),
        eq(studioSessions.status, "active"),
      ),
    );

  const [row] = await db
    .insert(studioSessions)
    .values({
      userId,
      packId,
      type,
      status: "active",
      targetRuleId: type === "component" ? (targetRuleId ?? null) : null,
      targetOpeningComponentId:
        type === "opening" ? (targetOpeningComponentId ?? null) : null,
      title: null,
      draftPayload: null,
    })
    .returning();
  revalidatePath(`/packs/${packId}/studio`);
  return { ok: true, session: row };
}

export async function updateSessionDraftAction(
  sessionId: string,
  draftPayload: unknown,
): Promise<Result> {
  const resolved = await resolveSession(sessionId);
  if (!resolved.ok) return resolved;
  if (resolved.session.status !== "active") {
    return { ok: false, error: "这份创作已结束，无法修改" };
  }
  const parsed = draftPayloadSchema.safeParse(draftPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: "这份改动无法读取，请重新生成",
    };
  }
  if (parsed.data.kind === "css" && resolved.session.type !== "css") {
    return { ok: false, error: "这份改动不适合当前创作" };
  }
  if (parsed.data.kind === "rule" && resolved.session.type !== "component") {
    return { ok: false, error: "这份改动不适合当前创作" };
  }
  if (parsed.data.kind === "opening" && resolved.session.type !== "opening") {
    return { ok: false, error: "这份改动不适合当前创作" };
  }

  await db
    .update(studioSessions)
    .set({
      draftPayload: parsed.data as StudioDraftPayload,
      updatedAt: new Date(),
    })
    .where(eq(studioSessions.id, sessionId));
  return { ok: true };
}

export async function commitStudioSessionAction(sessionId: string): Promise<
  Result<{
    rules: RegexRule[];
    globalCss: string;
    openingComponents: OpeningComponent[];
    session: StudioSession;
  }>
> {
  const resolved = await resolveSession(sessionId);
  if (!resolved.ok) return resolved;
  const { session } = resolved;
  if (session.status !== "active") {
    return { ok: false, error: "这份创作已结束" };
  }
  if (!session.draftPayload) {
    return { ok: false, error: "还没有可保存的改动" };
  }
  const payload = session.draftPayload as StudioDraftPayload;

  let result: {
    rules: RegexRule[];
    globalCss: string;
    openingComponents: OpeningComponent[];
  };
  if (payload.kind === "css") {
    if (session.type !== "css") {
      return { ok: false, error: "这份改动不适合当前创作" };
    }
    result = await writePackUpdates(session.packId, { globalCss: payload.css });
  } else if (payload.kind === "rule") {
    if (session.type !== "component") {
      return { ok: false, error: "这份改动不适合当前创作" };
    }
    if (session.targetRuleId) {
      result = await writePackUpdates(session.packId, {
        updatedRule: { id: session.targetRuleId, data: payload.rule },
      });
    } else {
      result = await writePackUpdates(session.packId, {
        newRules: [payload.rule],
      });
    }
  } else {
    if (session.type !== "opening") {
      return { ok: false, error: "这份改动不适合当前创作" };
    }
    if (session.targetOpeningComponentId) {
      result = await writePackUpdates(session.packId, {
        updatedOpening: {
          id: session.targetOpeningComponentId,
          data: payload.opening,
        },
      });
    } else {
      result = await writePackUpdates(session.packId, {
        newOpening: payload.opening,
      });
    }
  }

  const [committed] = await db
    .update(studioSessions)
    .set({ status: "committed", updatedAt: new Date() })
    .where(eq(studioSessions.id, sessionId))
    .returning();

  revalidatePath(`/packs/${session.packId}/studio`);
  return {
    ok: true,
    rules: result.rules,
    globalCss: result.globalCss,
    openingComponents: result.openingComponents,
    session: committed,
  };
}

export async function discardStudioSessionAction(
  sessionId: string,
): Promise<Result<{ session: StudioSession }>> {
  const resolved = await resolveSession(sessionId);
  if (!resolved.ok) return resolved;
  if (resolved.session.status !== "active") {
    return { ok: false, error: "只能放弃进行中的创作" };
  }
  const [row] = await db
    .update(studioSessions)
    .set({ status: "discarded", updatedAt: new Date() })
    .where(eq(studioSessions.id, sessionId))
    .returning();
  revalidatePath(`/packs/${resolved.session.packId}/studio`);
  return { ok: true, session: row };
}

export async function renameStudioSessionAction(
  sessionId: string,
  title: string,
): Promise<Result<{ session: StudioSession }>> {
  const resolved = await resolveSession(sessionId);
  if (!resolved.ok) return resolved;
  const trimmed = title.trim().slice(0, 80);
  const [row] = await db
    .update(studioSessions)
    .set({ title: trimmed.length > 0 ? trimmed : null, updatedAt: new Date() })
    .where(eq(studioSessions.id, sessionId))
    .returning();
  return { ok: true, session: row };
}

export async function clearStudioSessionHistoryAction(
  sessionId: string,
): Promise<Result> {
  const resolved = await resolveSession(sessionId);
  if (!resolved.ok) return resolved;
  if (resolved.session.status !== "active") {
    return { ok: false, error: "已结束的创作无法修改" };
  }
  await clearSessionMessages(sessionId);
  return { ok: true };
}

export async function getSessionMessagesAction(sessionId: string): Promise<
  | {
      ok: true;
      messages: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const resolved = await resolveSession(sessionId);
  if (!resolved.ok) return resolved;
  const msgs = await getSessionMessages(sessionId);
  return {
    ok: true,
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
  };
}
