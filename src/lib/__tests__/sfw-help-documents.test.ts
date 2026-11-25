import { describe, expect, test } from "bun:test";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { LEGAL_DOCUMENTS } from "@/lib/legal";
import {
  getSfwDocument,
  SFW_DOCUMENT_ROUTES,
  type SfwDocumentKind,
  sfwHelpLinks,
} from "@/lib/legal/sfw-documents";
import {
  hasSfwSignupConsent,
  sfwServiceCopy,
} from "@/lib/legal/sfw-service-copy";

describe("SFW help documents", () => {
  test("all public documents are complete and aligned across languages", () => {
    for (const kind of Object.keys(SFW_DOCUMENT_ROUTES) as SfwDocumentKind[]) {
      const baseline = getSfwDocument(kind, "zh-TW");
      for (const locale of SUPPORTED_LOCALES) {
        const doc = getSfwDocument(kind, locale);
        expect(doc.sections.map((s) => s.id)).toEqual(
          baseline.sections.map((s) => s.id),
        );
        expect(new Set(doc.sections.map((s) => s.id)).size).toBe(
          doc.sections.length,
        );
        expect(doc.title.trim().length).toBeGreaterThan(0);
        for (const section of doc.sections) {
          expect(section.heading.trim().length).toBeGreaterThan(0);
          for (const block of section.blocks) {
            expect(block.kind).toBe("paragraph");
            if (block.kind === "paragraph")
              expect(block.text.trim().length).toBeGreaterThan(20);
          }
        }
        expect(sfwHelpLinks(locale)).toHaveLength(7);
      }
    }
  });
  test("existing published terms and privacy anchors remain usable", () => {
    for (const kind of ["user-agreement", "privacy-policy"] as const) {
      expect(getSfwDocument(kind, "en").sections.map((s) => s.id)).toEqual(
        LEGAL_DOCUMENTS[kind].en.sections.map((s) => s.id),
      );
    }
  });
  test("formal policies have numbered substantive clauses in every language", () => {
    for (const kind of [
      "user-agreement",
      "privacy-policy",
      "billing",
      "refund",
      "content",
    ] as const) {
      const reference = getSfwDocument(kind, "zh-TW");
      for (const locale of SUPPORTED_LOCALES) {
        const doc = getSfwDocument(kind, locale);
        expect(doc.sections.map((s) => s.blocks.length)).toEqual(
          reference.sections.map((s) => s.blocks.length),
        );
        doc.sections.forEach((section, sectionIndex) => {
          expect(section.blocks.length).toBeGreaterThanOrEqual(2);
          expect(section.heading.startsWith(`${sectionIndex + 1}. `)).toBe(
            true,
          );
          section.blocks.forEach((block, paragraphIndex) => {
            if (block.kind === "paragraph")
              expect(
                block.text.startsWith(
                  `${sectionIndex + 1}.${paragraphIndex + 1} `,
                ),
              ).toBe(true);
          });
        });
        expect(JSON.stringify(doc)).not.toMatch(
          /MUFY AI INC|Perchy|SIAC|Texas|Stripe|R2 storage/,
        );
      }
    }
  });
  test("billing distinguishes coins from money refunds and avoids fictitious commitments", () => {
    const text = JSON.stringify([
      getSfwDocument("billing", "en"),
      getSfwDocument("refund", "en"),
    ]);
    expect(text).toContain("no automatic renewal");
    expect(text).toContain("original payment method");
    expect(text).toContain("test");
    expect(text).not.toMatch(/Stripe|14 days|exchange rate/);
    expect(text).toContain("10 business days");
    expect(text).toContain("not a refund arrival deadline");
    expect(text).toContain("coin");
  });
  test("age and legal consent must be explicitly submitted", () => {
    const form = new FormData();
    expect(hasSfwSignupConsent(form)).toBe(false);
    form.set("sfwConsent", "on");
    expect(hasSfwSignupConsent(form)).toBe(false);
    form.set("sfwConsent", "accepted");
    expect(hasSfwSignupConsent(form)).toBe(true);
    for (const locale of SUPPORTED_LOCALES) {
      const doc = JSON.stringify(getSfwDocument("contact", locale));
      expect(doc).toContain("StarEcho Technologies Limited");
      expect(doc).toContain("80678055");
      expect(doc).toContain(sfwServiceCopy(locale).replyTime);
    }
  });
});
