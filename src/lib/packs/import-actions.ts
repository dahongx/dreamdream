"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRequestDict } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import {
  beautificationPacks,
  openingComponents,
  regexRules,
} from "@/lib/db/schema";
import {
  convertLegacyCss,
  parseExternalRulesJson,
} from "@/lib/import/external-card";
import { saveImportBackup } from "@/lib/import/external-card-backup";
import { type ActionResult, updatePackAction } from "./actions";

/**
 * 导入外部美化（正则规则）导出的 JSON → **新建**一个私有美化包并写入规则。
 * 见 [docs] / src/lib/import/external-card.ts。解析层已保证不抛异常、字段映射好。
 */
export async function importExternalRulesAction(
  fileText: string,
  packName?: string,
): Promise<ActionResult<{ packId: string; ruleCount: number }>> {
  const dict = await getRequestDict();
  const userId = await getCurrentUserId();

  const parsed = parseExternalRulesJson(fileText);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const name = (packName?.trim() || dict.packs.importedExternalPackName).slice(
    0,
    128,
  );

  const [pack] = await db
    .insert(beautificationPacks)
    .values({ ownerUserId: userId, name, isPublic: false })
    .returning({ id: beautificationPacks.id });

  await db.insert(regexRules).values(
    parsed.value.map((r) => ({
      packId: pack.id,
      name: r.name,
      targetText: r.targetText,
      pattern: r.pattern,
      replacement: r.replacement,
      variableMapping: r.variableMapping,
      outputGuidance: r.outputGuidance,
      enabled: r.enabled,
      visible: r.visible,
      orderIndex: r.orderIndex,
    })),
  );

  await saveImportBackup({
    kind: "rules",
    userId,
    content: fileText,
    packId: pack.id,
    parseOk: true,
  });

  revalidatePath("/packs");
  return {
    ok: true,
    data: { packId: pack.id, ruleCount: parsed.value.length },
  };
}

/** 校验当前用户是该包 owner，返回 pack 行（带 globalCss）或 null。 */
async function ownedPack(packId: string, userId: string) {
  const [pack] = await db
    .select({
      id: beautificationPacks.id,
      globalCss: beautificationPacks.globalCss,
    })
    .from(beautificationPacks)
    .where(
      and(
        eq(beautificationPacks.id, packId),
        eq(beautificationPacks.ownerUserId, userId),
      ),
    )
    .limit(1);
  return pack ?? null;
}

/**
 * 导入外部正则 JSON → **追加**到「当前已有的包」（studio 对话组件 tab 用）。
 * 与 importExternalRulesAction（建新包）区别只在落点。orderIndex 接在现有规则后面。
 */
export async function importExternalRulesToPackAction(
  packId: string,
  fileText: string,
): Promise<ActionResult<{ ruleCount: number }>> {
  const userId = await getCurrentUserId();
  const pack = await ownedPack(packId, userId);
  if (!pack) return { ok: false, error: "找不到该美化包，或你没有编辑权限" };

  const parsed = parseExternalRulesJson(fileText);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const [agg] = await db
    .select({ max: sql<number | null>`max(${regexRules.orderIndex})` })
    .from(regexRules)
    .where(eq(regexRules.packId, packId));
  const base = (agg?.max ?? -1) + 1;

  await db.insert(regexRules).values(
    parsed.value.map((r, i) => ({
      packId,
      name: r.name,
      targetText: r.targetText,
      pattern: r.pattern,
      replacement: r.replacement,
      variableMapping: r.variableMapping,
      outputGuidance: r.outputGuidance,
      enabled: r.enabled,
      visible: r.visible,
      orderIndex: base + i,
    })),
  );

  await saveImportBackup({
    kind: "rules",
    userId,
    content: fileText,
    packId,
    parseOk: true,
  });

  revalidatePath(`/packs/${packId}/studio`);
  revalidatePath(`/packs/${packId}`);
  return { ok: true, data: { ruleCount: parsed.value.length } };
}

/**
 * 粘贴外部全局美化 CSS → 自动转选择器前缀 → **追加**到包的 globalCss
 * （studio 皮肤 tab 用）。读现有 CSS 再拼接，绝不覆盖已有皮肤。
 */
export async function importExternalCssToPackAction(
  packId: string,
  cssText: string,
): Promise<ActionResult<{ note: string }>> {
  const userId = await getCurrentUserId();
  const pack = await ownedPack(packId, userId);
  if (!pack) return { ok: false, error: "找不到该美化包，或你没有编辑权限" };

  const { css: converted, note } = convertLegacyCss(cssText);
  if (!converted.trim()) return { ok: false, error: "没有可导入的 CSS" };

  const existing = pack.globalCss?.trim() ?? "";
  // 去重：同一段已在皮肤里就不重复追加（避免反复导入堆叠）
  if (existing.includes(converted.trim())) {
    return { ok: true, data: { note: "这段全局美化已存在，未重复添加" } };
  }
  const merged = existing ? `${existing}\n\n${converted}` : converted;

  const result = await updatePackAction(packId, { globalCss: merged });
  if (!result.ok) return result;

  // 留底作者粘进来的**原文**（未做选择器前缀替换的那份），方便以后 prefix
  // 规则改了 / 转换器升级了能从原料重跑。
  await saveImportBackup({
    kind: "css",
    userId,
    content: cssText,
    packId,
    parseOk: true,
  });

  return { ok: true, data: { note: note || "全局美化已导入" } };
}

/**
 * 粘贴外部小剧场 HTML → 在包里**新建一个开场组件**（studio 开场组件 tab 用）。
 * 内容原样存（含外部 CDN 图片直链）；渲染端 sanitize/iframe 都放行 https 图。
 */
export async function importExternalOpeningToPackAction(
  packId: string,
  html: string,
  name?: string,
): Promise<ActionResult<{ name: string; id: string }>> {
  const userId = await getCurrentUserId();
  const pack = await ownedPack(packId, userId);
  if (!pack) return { ok: false, error: "找不到该美化包，或你没有编辑权限" };

  const content = html.trim();
  if (!content) return { ok: false, error: "内容为空" };
  const compName = (name?.trim() || "小剧场").slice(0, 128);

  const [agg] = await db
    .select({ max: sql<number | null>`max(${openingComponents.orderIndex})` })
    .from(openingComponents)
    .where(eq(openingComponents.packId, packId));
  const orderIndex = (agg?.max ?? -1) + 1;

  const [inserted] = await db
    .insert(openingComponents)
    .values({
      packId,
      name: compName,
      content,
      enabled: true,
      orderIndex,
    })
    .returning({ id: openingComponents.id });

  await saveImportBackup({
    kind: "xiaojuchang",
    userId,
    content,
    packId,
    label: compName,
    parseOk: true,
  });

  revalidatePath(`/packs/${packId}/studio`);
  revalidatePath(`/packs/${packId}`);
  return { ok: true, data: { name: compName, id: inserted.id } };
}
