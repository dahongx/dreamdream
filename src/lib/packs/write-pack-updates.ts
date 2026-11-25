import { and, asc, eq, max as sqlMax } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  beautificationPacks,
  type OpeningComponent,
  openingComponents,
  type RegexRule,
  regexRules,
} from "@/lib/db/schema";

/**
 * pack 写库原语 —— **故意不放在 `"use server"` 文件里**。
 *
 * 这个函数本身不做任何鉴权：它无条件按调用方给的 `packId` 写规则 / CSS /
 * 开场组件。之前它 `export` 在 session-actions.ts（`"use server"`）里，于是被
 * Next 注册成了公开 server action —— 拿到 action ID 就能对任意 packId 直接
 * POST，注入正则规则、覆写 globalCss，危害经 pack 订阅关系放大到所有订阅该
 * 包的角色卡聊天页（`runtime: 'iframe'` 规则还是带 JS 的 srcdoc 组件）。
 *
 * `"use server"` 文件里的 `export` 等于对外开端点，跟有没有 UI 调它无关。
 * 所以「内部 helper」必须物理隔离在普通模块里，光靠命名约定不够。
 *
 * 契约：**调用方负责先验 pack 归属**。当前两个入口都已验：
 *   - session-actions.ts 的 commit 系列走 resolveSession（比对 ownerUserId）
 *   - assistant-actions.ts 的 commitStudioDraftAction 自己查 ownerUserId
 */

export const ruleDraftSchema = z.object({
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

export const openingDraftSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().max(280).optional(),
  content: z.string().min(1),
  enabled: z.boolean().default(true),
});

/** 一次性把 pack 改动写库。两个 commit 入口（旧 draft / 新 session）共用。 */
export async function writePackUpdates(
  packId: string,
  args: {
    newRules?: Array<z.infer<typeof ruleDraftSchema>>;
    updatedRule?: { id: string; data: z.infer<typeof ruleDraftSchema> };
    newOpening?: z.infer<typeof openingDraftSchema>;
    updatedOpening?: { id: string; data: z.infer<typeof openingDraftSchema> };
    globalCss?: string | null | undefined;
  },
): Promise<{
  rules: RegexRule[];
  globalCss: string;
  openingComponents: OpeningComponent[];
}> {
  const {
    newRules = [],
    updatedRule,
    newOpening,
    updatedOpening,
    globalCss,
  } = args;

  if (newRules.length > 0) {
    const [row] = await db
      .select({ max: sqlMax(regexRules.orderIndex) })
      .from(regexRules)
      .where(eq(regexRules.packId, packId));
    let nextOrder = (row?.max ?? 0) + 1;
    for (const rule of newRules) {
      await db.insert(regexRules).values({
        packId,
        name: rule.name,
        targetText: rule.targetText ?? null,
        pattern: rule.pattern,
        replacement: rule.replacement,
        variableMapping: rule.variableMapping,
        outputGuidance: rule.outputGuidance ?? null,
        enabled: rule.enabled,
        visible: rule.visible,
        orderIndex: nextOrder,
      });
      nextOrder += 1;
    }
  }

  if (updatedRule) {
    await db
      .update(regexRules)
      .set({
        name: updatedRule.data.name,
        targetText: updatedRule.data.targetText ?? null,
        pattern: updatedRule.data.pattern,
        replacement: updatedRule.data.replacement,
        variableMapping: updatedRule.data.variableMapping,
        outputGuidance: updatedRule.data.outputGuidance ?? null,
        enabled: updatedRule.data.enabled,
        visible: updatedRule.data.visible,
        updatedAt: new Date(),
      })
      .where(
        and(eq(regexRules.id, updatedRule.id), eq(regexRules.packId, packId)),
      );
  }

  if (globalCss != null) {
    await db
      .update(beautificationPacks)
      .set({ globalCss, updatedAt: new Date() })
      .where(eq(beautificationPacks.id, packId));
  }

  if (newOpening) {
    const [row] = await db
      .select({ max: sqlMax(openingComponents.orderIndex) })
      .from(openingComponents)
      .where(eq(openingComponents.packId, packId));
    await db.insert(openingComponents).values({
      packId,
      name: newOpening.name,
      content: newOpening.content,
      enabled: newOpening.enabled,
      orderIndex: (row?.max ?? 0) + 1,
    });
  }

  if (updatedOpening) {
    await db
      .update(openingComponents)
      .set({
        name: updatedOpening.data.name,
        content: updatedOpening.data.content,
        enabled: updatedOpening.data.enabled,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(openingComponents.id, updatedOpening.id),
          eq(openingComponents.packId, packId),
        ),
      );
  }

  const finalRules = await db
    .select()
    .from(regexRules)
    .where(eq(regexRules.packId, packId));
  const finalOpening = await db
    .select()
    .from(openingComponents)
    .where(eq(openingComponents.packId, packId))
    .orderBy(asc(openingComponents.orderIndex));
  const [finalPack] = await db
    .select({ globalCss: beautificationPacks.globalCss })
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, packId))
    .limit(1);
  return {
    rules: finalRules,
    globalCss: finalPack?.globalCss ?? "",
    openingComponents: finalOpening,
  };
}
