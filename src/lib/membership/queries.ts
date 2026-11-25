import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { MembershipTier } from "./constants";

export interface UserMembership {
  tier: MembershipTier | null;
  expiresAt: Date | null;
  /** 当 tier 非空且 expiresAt > now() 才算 active —— 过期一律按未订阅处理。 */
  active: boolean;
}

export async function getUserMembership(
  userId: string,
): Promise<UserMembership> {
  const [row] = await db
    .select({
      tier: users.membershipTier,
      expiresAt: users.membershipExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.tier || !row.expiresAt) {
    return { tier: null, expiresAt: null, active: false };
  }

  const active = row.expiresAt.getTime() > Date.now();
  return {
    tier: row.tier,
    expiresAt: row.expiresAt,
    active,
  };
}
