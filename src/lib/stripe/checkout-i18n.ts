import type Stripe from "stripe";
import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import type { MembershipTier } from "@/lib/membership/constants";

type ShopCopy = Dict["shop"];

const STRIPE_CHECKOUT_LOCALES = {
  "zh-TW": "zh-TW",
  "ja-JP": "ja",
  "th-TH": "th",
  en: "en",
} as const satisfies Record<Locale, Stripe.Checkout.SessionCreateParams.Locale>;

/** Map product locales to the exact locale tags supported by Stripe Checkout. */
export function stripeCheckoutLocale(
  locale: Locale,
): Stripe.Checkout.SessionCreateParams.Locale {
  return STRIPE_CHECKOUT_LOCALES[locale];
}

function tierLabel(tier: MembershipTier, shop: ShopCopy): string {
  if (tier === "gold") return shop.tierGoldName;
  if (tier === "platinum") return shop.tierPlatinumName;
  return shop.tierDiamondName;
}

function fill(template: string, key: "tier" | "gold", value: string): string {
  return template.replace(`{${key}}`, value);
}

export function membershipCheckoutProduct(
  tier: MembershipTier,
  shop: ShopCopy,
): { name: string; description: string } {
  const displayName = tierLabel(tier, shop);
  return {
    name: fill(shop.checkoutMembershipName, "tier", displayName),
    description: shop.checkoutMembershipDescription,
  };
}

export function goldCheckoutProduct(
  gold: number,
  locale: Locale,
  shop: ShopCopy,
): { name: string; description: string } {
  const displayAmount = new Intl.NumberFormat(locale).format(gold);
  return {
    name: fill(shop.checkoutGoldName, "gold", displayAmount),
    description: fill(shop.checkoutGoldDescription, "gold", displayAmount),
  };
}
