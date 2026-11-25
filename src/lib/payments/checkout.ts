"use server";

import type { MembershipTier } from "@/lib/membership/constants";
import {
  createPayProoGoldOrder,
  createPayProoMembershipOrder,
} from "@/lib/payproo/checkout";
import {
  createCheckoutSession,
  createGoldPackageCheckoutSession,
} from "@/lib/stripe/checkout";

function usePayProo(): boolean {
  return (
    (process.env.PAYMENT_PROVIDER?.trim().toLowerCase() ?? "stripe") ===
    "payproo"
  );
}

export async function createMembershipPayment(
  tier: MembershipTier,
): Promise<{ url: string }> {
  return usePayProo()
    ? createPayProoMembershipOrder(tier)
    : createCheckoutSession(tier);
}

export async function createGoldPayment(
  packageId: string,
): Promise<{ url: string }> {
  return usePayProo()
    ? createPayProoGoldOrder(packageId)
    : createGoldPackageCheckoutSession(packageId);
}
