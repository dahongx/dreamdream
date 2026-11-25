import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { getRequestI18n, getRequestLocale } from "@/i18n/server";
import { getLegalDocument, LEGAL_ROUTES } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getLegalDocument("user-agreement", await getRequestLocale());
  return { title: doc.title };
}

/**
 * /agreement/user —— 用户协议。
 *
 * 走 dynamic：正文本身是静态常量，但要按请求 locale（cookie / Accept-Language）
 * 选版本，和站内其他 RSC 页面同一套取数方式。
 */
export const dynamic = "force-dynamic";

export default async function UserAgreementPage() {
  const { locale, dict } = await getRequestI18n();
  return (
    <LegalDocumentView
      counterpart={{
        href: LEGAL_ROUTES["privacy-policy"],
        label: dict.legal.privacyPolicy,
      }}
      dict={dict}
      document={getLegalDocument("user-agreement", locale)}
    />
  );
}
