import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { getRequestI18n, getRequestLocale } from "@/i18n/server";
import { getLegalDocument, LEGAL_ROUTES } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const doc = getLegalDocument("privacy-policy", await getRequestLocale());
  return { title: doc.title };
}

/** /agreement/privacy —— 隐私政策。取版本方式同 /agreement/user。 */
export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage() {
  const { locale, dict } = await getRequestI18n();
  return (
    <LegalDocumentView
      counterpart={{
        href: LEGAL_ROUTES["user-agreement"],
        label: dict.legal.userAgreement,
      }}
      dict={dict}
      document={getLegalDocument("privacy-policy", locale)}
    />
  );
}
