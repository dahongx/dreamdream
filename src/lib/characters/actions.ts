"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRequestDict } from "@/i18n/server";
import {
  getCurrentUserId,
  isCurrentUserDeveloper,
} from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import {
  beautificationPacks,
  characterPackSubscriptions,
  characters,
  regexRules,
  subscriptionRuleOverrides,
} from "@/lib/db/schema";
import { createCharacterFormSchema } from "./schema";
import {
  buildCharacterSubscriptionPlans,
  buildSubscriptionRuleOverridePlans,
  CHARACTER_FORM_CSS_PACK_FIELD,
  CHARACTER_FORM_OPENING_PACK_FIELD,
} from "./subscription-plan";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function parseFormData(formData: FormData) {
  // FormData → object, collecting same-named entries into arrays.
  const raw: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key in raw) {
      const existing = raw[key];
      raw[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      raw[key] = value;
    }
  }
  return raw;
}

export async function createCharacterAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const dict = await getRequestDict();
  const parsed = createCharacterFormSchema({
    nameRequired: dict.characterValidation.nameRequired,
    personaRequired: dict.characterValidation.personaRequired,
  }).safeParse(parseFormData(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: dict.characterValidation.formInvalid,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const ownerId = await getCurrentUserId();
  const data = parsed.data;
  // 顶栏 [发布] 按钮把 intent=publish 提交进 FormData,强制把可见性翻成 public。
  // 普通 [保存] 走 intent=save,保留用户在 A 区下拉里挑的可见性(可能是 unlisted)。
  const intent = String(formData.get("intent") ?? "save");
  const visibility = intent === "publish" ? "public" : data.visibility;

  const [row] = await db
    .insert(characters)
    .values({
      ownerId,
      name: data.name,
      gender: data.gender,
      age: data.age ?? null,
      nsfw: data.nsfw,
      isAi: data.isAi,
      contentType: data.contentType,
      coverImageUrl: data.coverImageUrl ?? null,
      avatarUrl: data.avatarUrl ?? null,
      tags: data.tags,
      bio: data.bio ?? null,
      creatorNote: data.creatorNote ?? null,
      visibility,
      persona: data.persona,
      adversity: data.adversity ?? null,
      defaultCognition: data.defaultCognition ?? null,
      opening: data.opening ?? null,
      plotSetting: data.plotSetting ?? null,
      outputSetting: data.outputSetting ?? null,
      sampleDialogue: data.sampleDialogue ?? null,
    })
    .returning({ id: characters.id });

  // Create a private pack for this character and auto-subscribe
  const [pack] = await db
    .insert(beautificationPacks)
    .values({
      ownerUserId: ownerId,
      name: dict.packs.characterPackNameFmt.replace("{name}", data.name),
      isPublic: false,
    })
    .returning({ id: beautificationPacks.id });

  // Collect rule IDs the user selected via the rule-level picker. Group by pack:
  // for each pack with ≥1 selected rule, subscribe; write disabled-overrides for
  // the pack's other rules so only the selected ones stay active.
  const selectedRuleIds = formData
    .getAll("ruleIds")
    .map(String)
    .filter(Boolean);
  const cssEnabledPackIds = new Set(
    formData.getAll(CHARACTER_FORM_CSS_PACK_FIELD).map(String).filter(Boolean),
  );
  const openingEnabledPackIds = new Set(
    formData
      .getAll(CHARACTER_FORM_OPENING_PACK_FIELD)
      .map(String)
      .filter(Boolean),
  );

  const selectedRulesMeta: Array<{ id: string; packId: string }> =
    selectedRuleIds.length > 0
      ? await db
          .select({ id: regexRules.id, packId: regexRules.packId })
          .from(regexRules)
          .where(inArray(regexRules.id, selectedRuleIds))
      : [];

  const {
    orderedPackIds,
    selectedByPack,
    subscriptions: subscriptionValues,
  } = buildCharacterSubscriptionPlans({
    characterId: row.id,
    privatePackId: pack.id,
    selectedRules: selectedRulesMeta,
    cssEnabledPackIds,
    openingEnabledPackIds,
  });
  const inserted = await db
    .insert(characterPackSubscriptions)
    .values(subscriptionValues)
    .returning({
      id: characterPackSubscriptions.id,
      packId: characterPackSubscriptions.packId,
    });

  // Write disabled-overrides for unselected rules within each subscribed pack.
  const allRules =
    orderedPackIds.length > 0
      ? await db
          .select({ id: regexRules.id, packId: regexRules.packId })
          .from(regexRules)
          .where(inArray(regexRules.packId, orderedPackIds))
      : [];

  const subIdByPack = new Map(inserted.map((s) => [s.packId, s.id]));
  const overrideValues = buildSubscriptionRuleOverridePlans({
    privatePackId: pack.id,
    allRules,
    selectedByPack,
    subIdByPack,
  });
  if (overrideValues.length > 0) {
    await db.insert(subscriptionRuleOverrides).values(overrideValues);
  }

  revalidatePath("/explore");
  redirect(`/characters/${row.id}`);
}

export async function updateCharacterAction(
  characterId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const dict = await getRequestDict();
  const parsed = createCharacterFormSchema({
    nameRequired: dict.characterValidation.nameRequired,
    personaRequired: dict.characterValidation.personaRequired,
  }).safeParse(parseFormData(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: dict.characterValidation.formInvalid,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const ownerId = await getCurrentUserId();
  const data = parsed.data;
  const intent = String(formData.get("intent") ?? "save");
  const visibility = intent === "publish" ? "public" : data.visibility;

  // 开发者(NIMIR_DEBUG_EMAILS)可保存任意卡;普通用户仍被 owner_id 锁死,
  // where 匹配 0 行即落到下方 notFoundOrNotOwner。与 edit 页同级旁路。
  const isDev = await isCurrentUserDeveloper();
  const ownerScope = isDev
    ? eq(characters.id, characterId)
    : and(eq(characters.id, characterId), eq(characters.ownerId, ownerId));

  const result = await db
    .update(characters)
    .set({
      name: data.name,
      gender: data.gender,
      age: data.age ?? null,
      nsfw: data.nsfw,
      isAi: data.isAi,
      contentType: data.contentType,
      coverImageUrl: data.coverImageUrl ?? null,
      avatarUrl: data.avatarUrl ?? null,
      tags: data.tags,
      bio: data.bio ?? null,
      creatorNote: data.creatorNote ?? null,
      visibility,
      persona: data.persona,
      adversity: data.adversity ?? null,
      defaultCognition: data.defaultCognition ?? null,
      opening: data.opening ?? null,
      plotSetting: data.plotSetting ?? null,
      outputSetting: data.outputSetting ?? null,
      sampleDialogue: data.sampleDialogue ?? null,
      updatedAt: new Date(),
    })
    .where(ownerScope)
    .returning({ id: characters.id });

  if (!result[0]) {
    return { ok: false, error: dict.characterValidation.notFoundOrNotOwner };
  }

  revalidatePath(`/characters/${characterId}`);
  revalidatePath(`/characters/${characterId}/edit`);
  revalidatePath("/explore");

  // 保存修改 keeps the user on the edit page so they can keep iterating;
  // 发布 is a terminal action, bounce out to the public detail view.
  if (intent === "publish") {
    redirect(`/characters/${characterId}`);
  }
  return { ok: true, data: { id: characterId } };
}

export async function deleteCharacterAction(
  characterId: string,
): Promise<ActionResult<null>> {
  const dict = await getRequestDict();
  const ownerId = await getCurrentUserId();

  // 先查订阅关系(删角色前),因为外键 cascade 会自动删订阅记录
  const subscriptions = await db
    .select({ packId: characterPackSubscriptions.packId })
    .from(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.characterId, characterId));

  // 删角色(会触发 cascade 删除订阅关系)
  const result = await db
    .delete(characters)
    .where(and(eq(characters.id, characterId), eq(characters.ownerId, ownerId)))
    .returning({ id: characters.id });

  if (!result[0]) {
    return { ok: false, error: dict.characterValidation.notFoundOrNotOwner };
  }

  // 级联删除该角色的专属美化包(外部导入时自动建的 `XXX 的美化包`):
  // 只删「私有 + owner 一致 + 只被这个角色订阅(现在订阅已被删,所以查其它角色订阅数=0)」的包,
  // 避免误删共享包。
  for (const { packId } of subscriptions) {
    const [pack] = await db
      .select({
        id: beautificationPacks.id,
        ownerUserId: beautificationPacks.ownerUserId,
        name: beautificationPacks.name,
        isPublic: beautificationPacks.isPublic,
      })
      .from(beautificationPacks)
      .where(eq(beautificationPacks.id, packId))
      .limit(1);

    if (!pack || pack.ownerUserId !== ownerId || pack.isPublic) continue;

    // 检查是否还有其他角色订阅这个包(订阅表里该 packId 的记录数)
    const otherSubs = await db
      .select({ count: sql<number>`count(*)` })
      .from(characterPackSubscriptions)
      .where(eq(characterPackSubscriptions.packId, packId));

    if (Number(otherSubs[0]?.count ?? 0) === 0) {
      // 没有其它订阅了 → 删包(会级联删 regex_rules / opening_components)
      await db
        .delete(beautificationPacks)
        .where(eq(beautificationPacks.id, packId));
    }
  }

  revalidatePath("/explore");
  return { ok: true, data: null };
}
