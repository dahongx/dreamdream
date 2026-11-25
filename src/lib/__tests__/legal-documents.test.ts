import { describe, expect, test } from "bun:test";
import { normalizeLocale, SUPPORTED_LOCALES } from "@/i18n/config";
import { en } from "@/i18n/en";
import { jaJP } from "@/i18n/ja-JP";
import { thTH } from "@/i18n/th-TH";
import { zh } from "@/i18n/zh";
import { zhTW } from "@/i18n/zh-TW";
import {
  getLegalDocument,
  LEGAL_ROUTES,
  type LegalDocumentKind,
} from "@/lib/legal";
import { LEGAL_CONTACT_EMAIL, LEGAL_SITE_DOMAIN } from "@/lib/legal/constants";
import type { LegalBlock, LegalDocument } from "@/lib/legal/types";

const KINDS: LegalDocumentKind[] = ["user-agreement", "privacy-policy"];

/**
 * 结构指纹 —— 每个 block 压成一个「类型[条目数]」的记号。
 * 条款编号跨语言错位、某语言漏翻一条列表项，都会在这里现形。
 */
function fingerprint(blocks: LegalBlock[]): string[] {
  return blocks.map((block) =>
    block.kind === "list"
      ? `list[${block.items.length}]`
      : block.kind === "notice"
        ? `notice[${block.items.length}]`
        : block.kind === "paragraph"
          ? `paragraph${block.strong ? "!" : ""}`
          : block.kind,
  );
}

function allText(doc: LegalDocument): string[] {
  const blockText = (block: LegalBlock): string[] => {
    if (block.kind === "list") return block.items;
    if (block.kind === "notice") return [block.title, ...block.items];
    return [block.text];
  };
  const fromBlocks = (blocks: LegalBlock[]) => blocks.flatMap(blockText);
  return [
    doc.title,
    doc.effectiveDate,
    ...fromBlocks(doc.intro),
    ...doc.sections.flatMap((section) => [
      section.heading,
      ...fromBlocks(section.blocks),
    ]),
  ];
}

for (const kind of KINDS) {
  describe(`legal document: ${kind}`, () => {
    const base = getLegalDocument(kind, "zh-TW");

    test("zh-TW baseline is substantive", () => {
      expect(base.sections.length).toBeGreaterThanOrEqual(10);
      expect(base.intro.length).toBeGreaterThan(0);
      for (const text of allText(base)) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    });

    for (const locale of SUPPORTED_LOCALES) {
      test(`${locale} matches the baseline structure`, () => {
        const doc = getLegalDocument(kind, locale);

        // 章节 id 是 URL fragment 兼交叉引用锚点，跨语言必须逐一对齐且同序。
        expect(doc.sections.map((section) => section.id)).toEqual(
          base.sections.map((section) => section.id),
        );

        expect(fingerprint(doc.intro)).toEqual(fingerprint(base.intro));
        for (const [index, section] of doc.sections.entries()) {
          expect(
            fingerprint(section.blocks),
            `${locale}:${section.id}`,
          ).toEqual(fingerprint(base.sections[index]?.blocks ?? []));
        }

        for (const text of allText(doc)) {
          expect(text.trim().length, `${locale}: empty string`).toBeGreaterThan(
            0,
          );
        }
      });

      test(`${locale} carries no Lumeow residue`, () => {
        // 这两份文书改写自竞品的公开协议。忘记脱敏一处品牌名/主体/管辖，
        // 就是把别人的法律主体写进了我们自己的合同里。
        const forbidden =
          /lumeow|lumiao|撸猫|嚕貓|新加坡|SIAC|singapore|女性向|ButterKnife|AndroidID/i;
        for (const text of allText(getLegalDocument(kind, locale))) {
          expect(
            forbidden.test(text),
            `${locale}: "${text.slice(0, 60)}"`,
          ).toBe(false);
        }
      });

      test(`${locale} states our own operator and venue`, () => {
        const joined = allText(getLegalDocument(kind, locale)).join("\n");
        expect(joined).toContain(LEGAL_CONTACT_EMAIL);
        // 主体所在地（日本）在每份文书里都要出现，否则用户无从知道跟谁签约。
        expect(/日本|Japan|ญี่ปุ่น/.test(joined)).toBe(true);
      });
    }

    test("a legacy zh-CN cookie still lands on a readable contract", () => {
      // 站点已下线简中，但迁移前的用户手上还揣着 nj_locale=zh-CN。
      // 折叠发生在 normalizeLocale，不在 legal 层——这里守的是「折完之后
      // 真的取得到文书」，别让老 cookie 的人打开协议页拿到 undefined。
      const folded = normalizeLocale("zh-CN");
      expect(folded).toBe("zh-TW");
      expect(
        getLegalDocument(kind, folded).title.trim().length,
      ).toBeGreaterThan(0);
    });
  });
}

describe("legal document wiring", () => {
  test("routes point at the shipped pages", () => {
    expect(LEGAL_ROUTES["user-agreement"]).toBe("/agreement/user");
    expect(LEGAL_ROUTES["privacy-policy"]).toBe("/agreement/privacy");
  });

  test("the user agreement names the platform domain", () => {
    const joined = allText(getLegalDocument("user-agreement", "zh-TW")).join(
      "\n",
    );
    expect(joined).toContain(LEGAL_SITE_DOMAIN);
  });

  test("chrome copy exists in every dictionary", () => {
    // zh 不是上线语言，但仍是翻译对齐测试比对的作者化源头，所以也要有 legal 段。
    for (const [locale, dict] of [
      ["zh (authoring source)", zh],
      ["zh-TW", zhTW],
      ["ja-JP", jaJP],
      ["th-TH", thTH],
      ["en", en],
    ] as const) {
      for (const [key, value] of Object.entries(dict.legal)) {
        expect(value.trim().length, `${locale}:legal.${key}`).toBeGreaterThan(
          0,
        );
      }
    }
  });
});
