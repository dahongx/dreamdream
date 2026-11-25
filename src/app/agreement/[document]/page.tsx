import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { getRequestI18n, getRequestLocale } from "@/i18n/server";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/config";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/constants";
import { SFW_DOCUMENT_ROUTES } from "@/lib/legal/sfw-documents";
import { getSiteDocument } from "@/lib/legal/site-documents";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ document: string }> };
function resolveDocument(value: string) {
  if (!LEGAL_PAGES_ENABLED) notFound();
  switch (value) {
    case "guide":
    case "billing":
    case "refund":
    case "content":
    case "contact":
      return value;
    default:
      notFound();
  }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = resolveDocument((await params).document);
  return { title: getSiteDocument(kind, await getRequestLocale()).title };
}
export default async function HelpDocumentPage({ params }: Props) {
  const kind = resolveDocument((await params).document);
  const { locale, dict } = await getRequestI18n();
  const guide = {
    href: SFW_DOCUMENT_ROUTES.guide,
    label: getSiteDocument("guide", locale).title,
  };
  return (
    <>
      <LegalDocumentView
        document={getSiteDocument(kind, locale)}
        dict={dict}
        counterpart={
          kind === "guide"
            ? {
                href: SFW_DOCUMENT_ROUTES["user-agreement"],
                label: dict.legal.userAgreement,
              }
            : guide
        }
      />
      {kind === "contact" && (
        <p className="mx-auto max-w-3xl px-[var(--page-px)] pb-[var(--space-xl)]">
          <a
            className="text-accent-primary underline underline-offset-4"
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      )}
    </>
  );
}
