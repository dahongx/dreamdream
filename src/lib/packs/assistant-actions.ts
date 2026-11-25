"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { beautificationPacks, type RegexRule } from "@/lib/db/schema";
import { writePackUpdates } from "@/lib/packs/write-pack-updates";

/**
 * 旧 studio 草稿提交入口 ——「session 模型」上线前的兼容包装。
 *
 * Studio AI 助手已经改成「一个 session = 一个产物」模式（见
 * src/lib/packs/session-actions.ts）。本文件保留给尚未迁移到 session 的
 * 调用面（StudioLayout 顶部 [保存]、CSS 直编抽屉里的手工 [保存]），它们
 * 在 Task #4 / #6 中会全部改走 session 流程，那时本函数将被删除。
 *
 * 当前实现：直接调用共享的 writePackUpdates，不再走「draft」DB 概念。
 */

const newRuleSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().max(280).optional(),
  targetText: z.string().nullable().optional(),
  pattern: z.string().min(1),
  replacement: z.string().default(""),
  variableMapping: z
    .array(
      z.object({
        index: z.number().int().min(1),
        name: z.string().min(1).max(64),
        sample: z.string().max(512).optional(),
      }),
    )
    .default([]),
  outputGuidance: z.string().nullable().optional(),
  enabled: z.boolean().default(true),
  visible: z.boolean().default(false),
});

const draftSchema = z.object({
  newRules: z.array(newRuleSchema).default([]),
  globalCss: z.string().max(32_000).nullable().optional(),
});

export type DraftInput = z.input<typeof draftSchema>;

export type CommitDraftResult =
  | { ok: true; rules: RegexRule[]; globalCss: string }
  | { ok: false; error: string };

export async function commitStudioDraftAction(
  packId: string,
  draft: unknown,
): Promise<CommitDraftResult> {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return { ok: false, error: "未登录" };
  }

  const [pack] = await db
    .select({ ownerUserId: beautificationPacks.ownerUserId })
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, packId))
    .limit(1);
  if (!pack || pack.ownerUserId !== userId) {
    return { ok: false, error: "找不到该美化包，或你没有编辑权限" };
  }

  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) {
    return {
      ok: false,
      error: `草稿格式不合法: ${parsed.error.issues[0]?.message ?? "未知"}`,
    };
  }

  const result = await writePackUpdates(packId, {
    newRules: parsed.data.newRules,
    globalCss: parsed.data.globalCss ?? undefined,
  });
  return { ok: true, ...result };
}
