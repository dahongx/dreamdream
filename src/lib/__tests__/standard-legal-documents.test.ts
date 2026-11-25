import { describe, expect, test } from "bun:test";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { getSfwDocument } from "@/lib/legal/sfw-documents";
import { getStandardDocument } from "@/lib/legal/site-documents";

describe("standard site legal adaptation", () => {
  test("preserves chapters and translated clause numbering", () => {
    for (const kind of [
      "user-agreement",
      "privacy-policy",
      "content",
    ] as const) {
      for (const locale of SUPPORTED_LOCALES) {
        const doc = getStandardDocument(kind, locale);
        expect(doc.sections.map((s) => s.id)).toEqual(
          getSfwDocument(kind, locale).sections.map((s) => s.id),
        );
        doc.sections.forEach((section, i) => {
          section.blocks.forEach((block, j) => {
            if (block.kind === "paragraph")
              expect(block.text.startsWith(`${i + 1}.${j + 1} `)).toBe(true);
          });
        });
        expect(JSON.stringify(doc)).not.toContain("play.dearm.ai");
      }
    }
  });
  test("describes creator ratings and the actual HTTP deployment", () => {
    const terms = JSON.stringify(getStandardDocument("user-agreement", "en"));
    expect(terms).toContain("ratings are declared by creators");
    expect(terms).toContain("StarEcho Technologies Limited");
    expect(terms).toContain("80678055");
    expect(terms).not.toContain(
      "Do not request or publish explicit sexual content",
    );
    const privacy = JSON.stringify(getStandardDocument("privacy-policy", "en"));
    expect(privacy).toContain("HTTP preview");
    expect(privacy).not.toContain("We use HTTPS");
    expect(privacy).not.toContain("Japanese entry point");
    expect(privacy).not.toContain("Cloudflare");
    const rules = JSON.stringify(getStandardDocument("content", "en"));
    expect(rules).toContain("minors");
    expect(rules).not.toContain("gentle stories");
    expect(rules).not.toContain(
      "Do not publish or request explicit sexual content",
    );
  });
  test("retains billing, refund terms and the configured support identity", () => {
    const refund = JSON.stringify(getStandardDocument("refund", "en"));
    expect(refund).toContain("10 business days");
    expect(refund).toContain("original payment method");
    const contact = JSON.stringify(getStandardDocument("contact", "en"));
    expect(contact).toContain("support@dearm.ai");
    expect(contact).toContain("StarEcho Technologies Limited");
  });
});
