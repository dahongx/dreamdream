import type { Locale } from "@/i18n/config";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/config";
import { privacyPolicyEn } from "@/lib/legal/documents/privacy-policy.en";
import { privacyPolicyJaJP } from "@/lib/legal/documents/privacy-policy.ja-JP";
import { privacyPolicyThTH } from "@/lib/legal/documents/privacy-policy.th-TH";
import { privacyPolicyZhTW } from "@/lib/legal/documents/privacy-policy.zh-TW";
import { userAgreementEn } from "@/lib/legal/documents/user-agreement.en";
import { userAgreementJaJP } from "@/lib/legal/documents/user-agreement.ja-JP";
import { userAgreementThTH } from "@/lib/legal/documents/user-agreement.th-TH";
import { userAgreementZhTW } from "@/lib/legal/documents/user-agreement.zh-TW";
import { getSiteDocument } from "@/lib/legal/site-documents";
import type { LegalDocument } from "@/lib/legal/types";

export type LegalDocumentKind = "user-agreement" | "privacy-policy";

/**
 * 每个上线语言都必须有两份文书 —— `Record<Locale, …>` 是这条约束的编译期保证：
 * 以后往 SUPPORTED_LOCALES 里加语言，这里会直接编译不过，逼你补上法律文本，
 * 而不是让新语言的用户静默看到另一种语言的合同。
 *
 * 简中不在其中：站点已下线 zh-CN（见 src/i18n/config.ts），所有中文请求折进
 * 繁中。这也正是我们要的——两份中文合同各自演进迟早对不上，而条款不一致的
 * 两个中文版本比一个繁体版更难向用户解释。
 */
export const LEGAL_DOCUMENTS: Record<
  LegalDocumentKind,
  Record<Locale, LegalDocument>
> = {
  "user-agreement": {
    "zh-TW": userAgreementZhTW,
    "ja-JP": userAgreementJaJP,
    "th-TH": userAgreementThTH,
    en: userAgreementEn,
  },
  "privacy-policy": {
    "zh-TW": privacyPolicyZhTW,
    "ja-JP": privacyPolicyJaJP,
    "th-TH": privacyPolicyThTH,
    en: privacyPolicyEn,
  },
};

export function getLegalDocument(
  kind: LegalDocumentKind,
  locale: Locale,
): LegalDocument {
  return LEGAL_PAGES_ENABLED
    ? getSiteDocument(kind, locale)
    : LEGAL_DOCUMENTS[kind][locale];
}

/** 路由片段 ↔ 文书种类。URL 保持 /agreement/user 与 /agreement/privacy。 */
export const LEGAL_ROUTES: Record<LegalDocumentKind, string> = {
  "user-agreement": "/agreement/user",
  "privacy-policy": "/agreement/privacy",
};

export type { LegalDocument } from "@/lib/legal/types";
