"use server";

import { revalidatePath } from "next/cache";
import { getRequestDict } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { forceSfwNsfw } from "@/lib/config/site";
import { db } from "@/lib/db/client";
import {
  beautificationPacks,
  characterPackSubscriptions,
  characters,
  openingComponents,
  regexRules,
} from "@/lib/db/schema";
import {
  convertLegacyCss,
  parseExternalCharacterXml,
} from "@/lib/import/external-card";
import { saveImportBackup } from "@/lib/import/external-card-backup";
import type { ActionResult } from "@/lib/packs/actions";

/** ImportExternalCardButton 与本 action 之间的契约。 */
export interface ImportExternalCardInput {
  xmlText: string;
  /** 浏览器侧 file.name，best-effort；用于服务器侧留底的文件命名。 */
  filename?: string;
}

/**
 * 导入外部角色卡 XML（含内嵌美化）→ 新建一个**私有**角色，并把内嵌的正则
 * 规则装进一个私有美化包、自动订阅给该角色。返回 characterId 让前端跳编辑页，
 * 让作者核对/补全外部导出没带过来的字段（默认认知 / 开场 / 输出设定等）。
 *
 * 一律落 private：别人的卡不该一进来就公开（与白名单/内容立场一致）。
 *
 * 留底：成功路径上调用 saveImportBackup 把原始 XML 落到服务器文件系统
 * （详见 src/lib/import/external-card-backup.ts）。备份失败不阻断导入。
 */
export async function importExternalCharacterAction(
  input: ImportExternalCardInput,
): Promise<ActionResult<{ characterId: string; lockedFields: string[] }>> {
  const dict = await getRequestDict();
  const userId = await getCurrentUserId();
  const { xmlText, filename } = input;

  const parsed = parseExternalCharacterXml(xmlText);
  if (!parsed.ok) {
    // 解析失败也留底 —— 排查解析器 bug 时找得回原始 XML
    await saveImportBackup({
      kind: "xml",
      userId,
      content: xmlText,
      originalFilename: filename,
      parseOk: false,
      parseError: parsed.error,
    });
    return { ok: false, error: parsed.error };
  }
  const { character: c, rules, customStyles, openingComponent, lockedFields } = parsed.value;

  // 外部 `<美化><样式代码>` 明文 CSS → 翻译选择器前缀后塞进新 pack 的
  // globalCss。之前这块被丢弃导致一键导入完成后 pack 永远是空 CSS，作者必须
  // 另外手工走 pack studio 的「粘贴外部美化」按钮——大量用户从来不知道这步，
  // 全库审计显示猫猫大王 3/3 全军覆没。
  const convertedGlobalCss = customStyles
    ? convertLegacyCss(customStyles).css
    : null;

  const [row] = await db
    .insert(characters)
    .values({
      ownerId: userId,
      name: c.name,
      gender: c.gender,
      age: c.age,
      nsfw: forceSfwNsfw(c.nsfw),
      isAi: c.isAi,
      contentType: c.contentType,
      coverImageUrl: c.coverImageUrl,
      avatarUrl: c.avatarUrl,
      tags: c.tags,
      bio: c.bio,
      creatorNote: c.creatorNote,
      persona: c.persona,
      adversity: c.adversity,
      defaultCognition: c.defaultCognition,
      opening: c.opening,
      plotSetting: c.plotSetting,
      outputSetting: c.outputSetting,
      sampleDialogue: c.sampleDialogue,
      visibility: "private",
    })
    .returning({ id: characters.id });

  // 无条件建一个私有美化包 + 订阅（对齐正常创建角色的行为）。即使 XML 没带
  // 正则也要建：迁移用户搬过来后还得手动补 CSS / 小剧场（这两块来源平台加密、
  // 带不过来），没有包他们根本无处可贴。带了正则就顺便装进去。
  const [pack] = await db
    .insert(beautificationPacks)
    .values({
      ownerUserId: userId,
      name: dict.packs.characterPackNameFmt.replace("{name}", c.name),
      isPublic: false,
      globalCss: convertedGlobalCss,
    })
    .returning({ id: beautificationPacks.id });

  if (openingComponent) {
    await db.insert(openingComponents).values({
      packId: pack.id,
      name: "导入的开场组件",
      content: openingComponent,
      enabled: true,
      orderIndex: 0,
    });
  }

  if (rules.length > 0) {
    await db.insert(regexRules).values(
      rules.map((r) => ({
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
  }

  await db.insert(characterPackSubscriptions).values({
    characterId: row.id,
    packId: pack.id,
    orderIndex: 0,
  });

  await saveImportBackup({
    kind: "xml",
    userId,
    content: xmlText,
    originalFilename: filename,
    characterId: row.id,
    characterName: c.name,
    packId: pack.id,
    parseOk: true,
    lockedFields,
  });

  revalidatePath("/mine");
  return { ok: true, data: { characterId: row.id, lockedFields } };
}
