"use server";

import { and, eq, inArray, max as sqlMax } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { beautificationPacks, regexRules } from "@/lib/db/schema";
import { regexRuleFormSchema } from "./schema";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function revalidatePackSurfaces(packId: string) {
  revalidatePath(`/packs/${packId}/studio`);
  revalidatePath(`/packs/${packId}`);
}

function parseFormData(formData: FormData) {
  const raw: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData.entries()) raw[key] = value;
  return raw;
}

async function assertPackOwner(
  packId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: beautificationPacks.id })
    .from(beautificationPacks)
    .where(
      and(
        eq(beautificationPacks.id, packId),
        eq(beautificationPacks.ownerUserId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function createRegexRuleAction(
  packId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await insertRegexRule(packId, formData);
  if (!result.ok) return result;
  redirect(`/packs/${packId}/studio`);
}

async function insertRegexRule(
  packId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!(await assertPackOwner(packId, userId))) {
    return { ok: false, error: "找不到该美化包，或你没有编辑权限" };
  }

  const parsed = regexRuleFormSchema.safeParse(parseFormData(formData));
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
  const data = parsed.data;

  let orderIndex = data.orderIndex;
  if (!orderIndex) {
    const [row] = await db
      .select({ max: sqlMax(regexRules.orderIndex) })
      .from(regexRules)
      .where(eq(regexRules.packId, packId));
    orderIndex = (row?.max ?? 0) + 1;
  }

  const [row] = await db
    .insert(regexRules)
    .values({
      packId,
      name: data.name,
      targetText: data.targetText ?? null,
      pattern: data.pattern,
      replacement: data.replacement,
      variableMapping: data.variableMapping,
      outputGuidance: data.outputGuidance ?? null,
      enabled: data.enabled,
      visible: data.visible,
      orderIndex,
    })
    .returning({ id: regexRules.id });

  revalidatePackSurfaces(packId);
  return { ok: true, data: { id: row.id } };
}

export async function updateRegexRuleAction(
  ruleId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await saveRegexRule(ruleId, formData);
  if (!result.ok) return result;
  redirect(`/packs/${result.data.packId}/studio`);
}

async function saveRegexRule(
  ruleId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; packId: string }>> {
  const userId = await getCurrentUserId();

  const [existing] = await db
    .select({
      packId: regexRules.packId,
      ownerUserId: beautificationPacks.ownerUserId,
    })
    .from(regexRules)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, regexRules.packId),
    )
    .where(eq(regexRules.id, ruleId))
    .limit(1);
  if (!existing || existing.ownerUserId !== userId) {
    return { ok: false, error: "找不到该对话组件，或你没有编辑权限" };
  }

  const parsed = regexRuleFormSchema.safeParse(parseFormData(formData));
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
  const data = parsed.data;

  await db
    .update(regexRules)
    .set({
      name: data.name,
      targetText: data.targetText ?? null,
      pattern: data.pattern,
      replacement: data.replacement,
      variableMapping: data.variableMapping,
      outputGuidance: data.outputGuidance ?? null,
      enabled: data.enabled,
      visible: data.visible,
      orderIndex: data.orderIndex,
      updatedAt: new Date(),
    })
    .where(eq(regexRules.id, ruleId));

  revalidatePackSurfaces(existing.packId);
  return { ok: true, data: { id: ruleId, packId: existing.packId } };
}

export async function deleteRegexRuleAction(
  ruleId: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();

  const [existing] = await db
    .select({
      packId: regexRules.packId,
      ownerUserId: beautificationPacks.ownerUserId,
    })
    .from(regexRules)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, regexRules.packId),
    )
    .where(eq(regexRules.id, ruleId))
    .limit(1);
  if (!existing || existing.ownerUserId !== userId) {
    return { ok: false, error: "找不到该对话组件，或你没有编辑权限" };
  }

  await db.delete(regexRules).where(eq(regexRules.id, ruleId));
  revalidatePackSurfaces(existing.packId);
  return { ok: true, data: null };
}

export async function swapRegexRuleOrderAction(
  aId: string,
  bId: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();

  const rows = await db
    .select({
      id: regexRules.id,
      packId: regexRules.packId,
      orderIndex: regexRules.orderIndex,
      ownerUserId: beautificationPacks.ownerUserId,
    })
    .from(regexRules)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, regexRules.packId),
    )
    .where(inArray(regexRules.id, [aId, bId]));

  if (rows.length !== 2) {
    return { ok: false, error: "找不到要调整顺序的对话组件" };
  }
  const [a, b] = rows;
  if (a.ownerUserId !== userId || b.ownerUserId !== userId) {
    return { ok: false, error: "你没有调整这些对话组件的权限" };
  }
  if (a.packId !== b.packId) {
    return { ok: false, error: "两个对话组件不属于同一个美化包" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(regexRules)
      .set({ orderIndex: -1, updatedAt: new Date() })
      .where(eq(regexRules.id, a.id));
    await tx
      .update(regexRules)
      .set({ orderIndex: a.orderIndex, updatedAt: new Date() })
      .where(eq(regexRules.id, b.id));
    await tx
      .update(regexRules)
      .set({ orderIndex: b.orderIndex, updatedAt: new Date() })
      .where(eq(regexRules.id, a.id));
  });

  revalidatePackSurfaces(a.packId);
  return { ok: true, data: null };
}
