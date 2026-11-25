import { type MembershipTier, TIER_SPECS } from "@/lib/membership/constants";

export const MASK_LIMIT = 2;

export function canCreateMask(unlimited: boolean, count: number): boolean {
  return unlimited || count < MASK_LIMIT;
}

export function hasUnlimitedMaskBenefit(
  tier: MembershipTier | null,
  expiresAt: Date | null,
  now = Date.now(),
): boolean {
  return Boolean(
    tier &&
      expiresAt &&
      expiresAt.getTime() > now &&
      TIER_SPECS[tier]?.benefits.unlimitedMasks,
  );
}
