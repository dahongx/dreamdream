import { describe, expect, test } from "bun:test";
import type { Locale } from "@/i18n/config";
import { en } from "@/i18n/en";
import { jaJP } from "@/i18n/ja-JP";
import { thTH } from "@/i18n/th-TH";
import type { Dict } from "@/i18n/types";
import { zhTW } from "@/i18n/zh-TW";
import {
  goldCheckoutProduct,
  membershipCheckoutProduct,
  stripeCheckoutLocale,
} from "@/lib/stripe/checkout-i18n";

const cases: Array<{
  locale: Locale;
  dict: Dict;
  stripeLocale: "zh-TW" | "ja" | "th" | "en";
  membershipName: string;
  goldName: string;
}> = [
  {
    locale: "zh-TW",
    dict: zhTW,
    stripeLocale: "zh-TW",
    membershipName: "黃金會員月卡（30 天）",
    goldName: "3,600 金幣",
  },
  {
    locale: "ja-JP",
    dict: jaJP,
    stripeLocale: "ja",
    membershipName: "ゴールド会員月間パス（30日間）",
    goldName: "3,600 ゴールド",
  },
  {
    locale: "th-TH",
    dict: thTH,
    stripeLocale: "th",
    membershipName: "บัตรรายเดือน โกลด์ (30 วัน)",
    goldName: "เหรียญทอง 3,600 เหรียญ",
  },
  {
    locale: "en",
    dict: en,
    stripeLocale: "en",
    membershipName: "Gold 30-day pass",
    goldName: "3,600 gold coins",
  },
];

describe("localized Stripe Checkout presentation", () => {
  for (const item of cases) {
    test(`${item.locale} maps to a supported Stripe locale`, () => {
      expect(stripeCheckoutLocale(item.locale)).toBe(item.stripeLocale);
    });

    test(`${item.locale} renders localized product copy`, () => {
      const membership = membershipCheckoutProduct("gold", item.dict.shop);
      const gold = goldCheckoutProduct(3600, item.locale, item.dict.shop);

      expect(membership).toEqual({
        name: item.membershipName,
        description: item.dict.shop.checkoutMembershipDescription,
      });
      expect(gold.name).toBe(item.goldName);
      expect(gold.description).toBe(
        item.dict.shop.checkoutGoldDescription.replace("{gold}", "3,600"),
      );
      expect(
        `${membership.name}${membership.description}${gold.name}${gold.description}`,
      ).not.toMatch(/\{(?:tier|gold)\}/);
    });

    test(`${item.locale} keeps one-time and pending payment copy honest`, () => {
      expect(item.dict.shop.pricePerPeriod).toContain("30");
      expect(item.dict.shop.payProcessingTitle).not.toBe(
        item.dict.shop.paySuccessTitle,
      );
      expect(item.dict.shop.payProcessingBody).not.toBe(
        item.dict.shop.paySuccessBody,
      );

      for (const implementedBenefit of [
        "tierGoldTagline",
        "tierPlatinumTagline",
        "tierDiamondTagline",
        "recommendedLabel",
        "pricePerMonth",
        "subscribeButton",
        "subscribeButtonActive",
        "subscribeSuccessOk",
        "rowInstantSilverFmt",
        "rowDailySilverFmt",
        "rowUnlimitedArchive",
        "rowNoWaitPeak",
        "rowMemoryBoost",
      ]) {
        expect(item.dict.shop[implementedBenefit]).toBeTruthy();
      }

      expect(
        item.dict.shop.rowInstantSilverFmt.replace("{count}", "100"),
      ).not.toMatch(/\{count\}/);
      expect(
        item.dict.shop.rowDailySilverFmt.replace("{count}", "100"),
      ).not.toMatch(/\{count\}/);
      expect(
        `${item.dict.shop.pricePerMonth}${item.dict.shop.pricePerPeriod}`,
      ).toContain("30");
    });
  }
});
