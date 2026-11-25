import { and, eq, gt, isNull, max, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  inviteCodeRedemptions,
  inviteCodes,
  type UserRole,
  users,
} from "@/lib/db/schema";

const DAILY_LIMIT_REGULAR = 10;
const DAILY_LIMIT_ADMIN = 999999;
const DAILY_LIMIT_BETA_FALLBACK = 200;

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  role: UserRole;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface BetaCheckResult {
  role: UserRole;
  dailyLimit: number;
}

async function checkBetaTesterExpiry(userId: string): Promise<BetaCheckResult> {
  const [result] = await db
    .select({ maxDailyLimit: max(inviteCodes.dailyLimit) })
    .from(inviteCodeRedemptions)
    .innerJoin(inviteCodes, eq(inviteCodeRedemptions.codeId, inviteCodes.id))
    .where(
      and(
        eq(inviteCodeRedemptions.userId, userId),
        or(
          isNull(inviteCodes.expiresAt),
          gt(inviteCodes.expiresAt, new Date()),
        ),
      ),
    );

  if (result?.maxDailyLimit != null) {
    return { role: "beta_tester", dailyLimit: result.maxDailyLimit };
  }

  await db.update(users).set({ role: "regular" }).where(eq(users.id, userId));
  return { role: "regular", dailyLimit: DAILY_LIMIT_REGULAR };
}

function limitForRole(role: UserRole): number {
  if (role === "admin") return DAILY_LIMIT_ADMIN;
  if (role === "regular") return DAILY_LIMIT_REGULAR;
  return DAILY_LIMIT_BETA_FALLBACK;
}

/**
 * Atomically check + increment daily quota.
 *
 * Single UPDATE with conditional reset handles date rollover + limit check
 * in one statement to avoid race conditions between concurrent requests.
 */
export async function checkAndIncrementQuota(
  userId: string,
): Promise<QuotaCheckResult> {
  const today = todayStr();

  const [row] = await db
    .select({
      role: users.role,
      dailyUsageCount: users.dailyUsageCount,
      usageDate: users.usageDate,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return { allowed: false, remaining: 0, limit: 0, role: "regular" };
  }

  let effectiveRole = row.role;
  let limit: number;
  if (effectiveRole === "beta_tester") {
    const beta = await checkBetaTesterExpiry(userId);
    effectiveRole = beta.role;
    limit = beta.dailyLimit;
  } else {
    limit = limitForRole(effectiveRole);
  }
  const currentCount = row.usageDate === today ? row.dailyUsageCount : 0;

  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, limit, role: effectiveRole };
  }

  // Atomic increment with date rollover: if date changed, reset to 1; else increment.
  const updated = await db
    .update(users)
    .set({
      dailyUsageCount: sql`CASE WHEN ${users.usageDate} = ${today} THEN ${users.dailyUsageCount} + 1 ELSE 1 END`,
      usageDate: today,
    })
    .where(
      and(
        eq(users.id, userId),
        sql`(${users.usageDate} != ${today} OR ${users.dailyUsageCount} < ${limit})`,
      ),
    )
    .returning({ dailyUsageCount: users.dailyUsageCount });

  if (updated.length === 0) {
    return { allowed: false, remaining: 0, limit, role: effectiveRole };
  }

  return {
    allowed: true,
    remaining: limit - updated[0].dailyUsageCount,
    limit,
    role: effectiveRole,
  };
}

/**
 * Roll back one quota increment (e.g. when the downstream API call fails).
 * Only decrements if the usage date is still today and count > 0.
 */
export async function rollbackQuota(userId: string): Promise<void> {
  const today = todayStr();
  await db
    .update(users)
    .set({
      dailyUsageCount: sql`${users.dailyUsageCount} - 1`,
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.usageDate, today),
        sql`${users.dailyUsageCount} > 0`,
      ),
    );
}

/** Read-only check without incrementing (for UI display). */
export async function getQuotaStatus(
  userId: string,
): Promise<QuotaCheckResult> {
  const today = todayStr();

  const [row] = await db
    .select({
      role: users.role,
      dailyUsageCount: users.dailyUsageCount,
      usageDate: users.usageDate,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return { allowed: false, remaining: 0, limit: 0, role: "regular" };
  }

  let limit: number;
  if (row.role === "beta_tester") {
    const beta = await checkBetaTesterExpiry(userId);
    limit = beta.dailyLimit;
  } else {
    limit = limitForRole(row.role);
  }
  const currentCount = row.usageDate === today ? row.dailyUsageCount : 0;

  return {
    allowed: currentCount < limit,
    remaining: Math.max(0, limit - currentCount),
    limit,
    role: row.role,
  };
}
