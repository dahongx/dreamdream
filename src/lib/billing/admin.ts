"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidatePricingCache } from "@/lib/ai/pricing";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { modelPriceHistory, modelPrices, users } from "@/lib/db/schema";

/**
 * Admin billing config — list and edit per-model prices stored in
 * model_prices. Edits append a snapshot to model_price_history for
 * audit, and bust the in-process pricing cache so the next billing
 * computation in this worker sees the new rate immediately. Other
 * workers refresh on their next cache TTL boundary.
 *
 * Historical messages keep their original cost_millicents (frozen at
 * write time), so changing a price never retroactively rewrites past
 * billing.
 */

// Integer-micro encoding: 1.0 → 1_000_000. Same divisor for prices and rate.
const MICRO_DIVISOR = 1_000_000;

function toMicro(n: number): number {
  return Math.round(n * MICRO_DIVISOR);
}

function fromMicro(n: number): number {
  return n / MICRO_DIVISOR;
}

export interface ModelPriceRow {
  modelId: string;
  displayName: string;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
  reasoningPerMTok: number;
  usdCnyRate: number;
  goldCostPerCall: number;
  silverCostPerCall: number;
  notes: string | null;
  updatedAt: string;
  updatedByEmail: string | null;
}

export interface ModelPriceHistoryRow {
  id: string;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
  reasoningPerMTok: number;
  usdCnyRate: number;
  notes: string | null;
  effectiveFrom: string;
  changedByEmail: string | null;
}

async function requireAdmin(): Promise<string> {
  const userId = await getCurrentUserId();
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (me?.role !== "admin") {
    throw new Error("Forbidden");
  }
  return userId;
}

export async function listModelPrices(): Promise<ModelPriceRow[]> {
  const userId = await getCurrentUserId();
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (me?.role !== "admin") return [];

  const rows = await db
    .select({
      modelId: modelPrices.modelId,
      displayName: modelPrices.displayName,
      inputPerMTokMicroUsd: modelPrices.inputPerMTokMicroUsd,
      outputPerMTokMicroUsd: modelPrices.outputPerMTokMicroUsd,
      cacheReadPerMTokMicroUsd: modelPrices.cacheReadPerMTokMicroUsd,
      cacheWritePerMTokMicroUsd: modelPrices.cacheWritePerMTokMicroUsd,
      reasoningPerMTokMicroUsd: modelPrices.reasoningPerMTokMicroUsd,
      usdCnyRateMicro: modelPrices.usdCnyRateMicro,
      goldCostPerCall: modelPrices.goldCostPerCall,
      silverCostPerCall: modelPrices.silverCostPerCall,
      notes: modelPrices.notes,
      updatedAt: modelPrices.updatedAt,
      updatedByEmail: users.email,
    })
    .from(modelPrices)
    .leftJoin(users, eq(modelPrices.updatedBy, users.id))
    .orderBy(modelPrices.displayName);

  return rows.map((r) => ({
    modelId: r.modelId,
    displayName: r.displayName,
    inputPerMTok: fromMicro(r.inputPerMTokMicroUsd),
    outputPerMTok: fromMicro(r.outputPerMTokMicroUsd),
    cacheReadPerMTok: fromMicro(r.cacheReadPerMTokMicroUsd),
    cacheWritePerMTok: fromMicro(r.cacheWritePerMTokMicroUsd),
    reasoningPerMTok: fromMicro(r.reasoningPerMTokMicroUsd),
    usdCnyRate: fromMicro(r.usdCnyRateMicro),
    goldCostPerCall: r.goldCostPerCall,
    silverCostPerCall: r.silverCostPerCall,
    notes: r.notes,
    updatedAt: r.updatedAt.toISOString(),
    updatedByEmail: r.updatedByEmail,
  }));
}

export async function listModelPriceHistory(
  modelId: string,
  limit = 20,
): Promise<ModelPriceHistoryRow[]> {
  const userId = await getCurrentUserId();
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (me?.role !== "admin") return [];

  const rows = await db
    .select({
      id: modelPriceHistory.id,
      inputPerMTokMicroUsd: modelPriceHistory.inputPerMTokMicroUsd,
      outputPerMTokMicroUsd: modelPriceHistory.outputPerMTokMicroUsd,
      cacheReadPerMTokMicroUsd: modelPriceHistory.cacheReadPerMTokMicroUsd,
      cacheWritePerMTokMicroUsd: modelPriceHistory.cacheWritePerMTokMicroUsd,
      reasoningPerMTokMicroUsd: modelPriceHistory.reasoningPerMTokMicroUsd,
      usdCnyRateMicro: modelPriceHistory.usdCnyRateMicro,
      notes: modelPriceHistory.notes,
      effectiveFrom: modelPriceHistory.effectiveFrom,
      changedByEmail: users.email,
    })
    .from(modelPriceHistory)
    .leftJoin(users, eq(modelPriceHistory.changedBy, users.id))
    .where(eq(modelPriceHistory.modelId, modelId))
    .orderBy(desc(modelPriceHistory.effectiveFrom))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    inputPerMTok: fromMicro(r.inputPerMTokMicroUsd),
    outputPerMTok: fromMicro(r.outputPerMTokMicroUsd),
    cacheReadPerMTok: fromMicro(r.cacheReadPerMTokMicroUsd),
    cacheWritePerMTok: fromMicro(r.cacheWritePerMTokMicroUsd),
    reasoningPerMTok: fromMicro(r.reasoningPerMTokMicroUsd),
    usdCnyRate: fromMicro(r.usdCnyRateMicro),
    notes: r.notes,
    effectiveFrom: r.effectiveFrom.toISOString(),
    changedByEmail: r.changedByEmail,
  }));
}

// Accept admin-entered USD values; max $10000/M tok is a soft upper bound
// (sanity guard against fat-fingered extra zero).
const priceField = z.coerce
  .number()
  .min(0, "价格不能为负")
  .max(10_000, "价格上限 $10000/M tok");

// USD→CNY rate: realistic range [3, 20] gives plenty of room, hard limit
// 0.1 / 100 catches typos without flagging a stronger / weaker yuan.
const rateField = z.coerce
  .number()
  .min(0.1, "汇率不能小于 0.1")
  .max(100, "汇率上限 100");

// Currency cost per call: non-negative integer, max 10000 (sanity guard)
const currencyCostField = z.coerce
  .number()
  .int("必须为整数")
  .min(0, "不能为负")
  .max(10_000, "上限 10000");

const updatePriceSchema = z.object({
  modelId: z.string().min(1),
  displayName: z.string().min(1, "请填模型展示名").max(128),
  inputPerMTok: priceField,
  outputPerMTok: priceField,
  cacheReadPerMTok: priceField,
  cacheWritePerMTok: priceField,
  reasoningPerMTok: priceField,
  usdCnyRate: rateField,
  goldCostPerCall: currencyCostField,
  silverCostPerCall: currencyCostField,
  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().max(500).nullable(),
  ),
});

export type UpdatePriceResult =
  | { ok: true; modelId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateModelPriceAction(
  _prev: UpdatePriceResult | null,
  formData: FormData,
): Promise<UpdatePriceResult> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const parsed = updatePriceSchema.safeParse({
    modelId: formData.get("modelId"),
    displayName: formData.get("displayName"),
    inputPerMTok: formData.get("inputPerMTok"),
    outputPerMTok: formData.get("outputPerMTok"),
    cacheReadPerMTok: formData.get("cacheReadPerMTok"),
    cacheWritePerMTok: formData.get("cacheWritePerMTok"),
    reasoningPerMTok: formData.get("reasoningPerMTok"),
    usdCnyRate: formData.get("usdCnyRate"),
    goldCostPerCall: formData.get("goldCostPerCall"),
    silverCostPerCall: formData.get("silverCostPerCall"),
    notes: formData.get("notes"),
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

  const d = parsed.data;
  const microValues = {
    inputPerMTokMicroUsd: toMicro(d.inputPerMTok),
    outputPerMTokMicroUsd: toMicro(d.outputPerMTok),
    cacheReadPerMTokMicroUsd: toMicro(d.cacheReadPerMTok),
    cacheWritePerMTokMicroUsd: toMicro(d.cacheWritePerMTok),
    reasoningPerMTokMicroUsd: toMicro(d.reasoningPerMTok),
    usdCnyRateMicro: toMicro(d.usdCnyRate),
  };

  const now = new Date();

  await db.transaction(async (tx) => {
    // Upsert: existing models get UPDATE; admin can also seed a brand-new
    // model_id (e.g. a newly added Claude version) before code wires it in.
    const existing = await tx
      .select({ modelId: modelPrices.modelId })
      .from(modelPrices)
      .where(eq(modelPrices.modelId, d.modelId))
      .limit(1);

    if (existing.length === 0) {
      await tx.insert(modelPrices).values({
        modelId: d.modelId,
        displayName: d.displayName,
        ...microValues,
        goldCostPerCall: d.goldCostPerCall,
        silverCostPerCall: d.silverCostPerCall,
        notes: d.notes,
        updatedAt: now,
        updatedBy: userId,
      });
    } else {
      await tx
        .update(modelPrices)
        .set({
          displayName: d.displayName,
          ...microValues,
          goldCostPerCall: d.goldCostPerCall,
          silverCostPerCall: d.silverCostPerCall,
          notes: d.notes,
          updatedAt: now,
          updatedBy: userId,
        })
        .where(eq(modelPrices.modelId, d.modelId));
    }

    await tx.insert(modelPriceHistory).values({
      modelId: d.modelId,
      displayName: d.displayName,
      ...microValues,
      notes: d.notes,
      effectiveFrom: now,
      changedBy: userId,
    });
  });

  invalidatePricingCache();
  revalidatePath("/settings");
  return { ok: true, modelId: d.modelId };
}
