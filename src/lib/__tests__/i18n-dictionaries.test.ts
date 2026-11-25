import { describe, expect, test } from "bun:test";
import { en } from "@/i18n/en";
import { jaJP } from "@/i18n/ja-JP";
import { thTH } from "@/i18n/th-TH";
import type { Dict } from "@/i18n/types";
import { zh } from "@/i18n/zh";
import { zhTW } from "@/i18n/zh-TW";
import {
  CHARACTER_TAG_OPTIONS,
  localizeCharacterTag,
  localizeCharacterTagOptions,
} from "@/lib/characters/tags";

type LeafMap = Map<string, string>;

function stringLeaves(value: unknown, path = "", result: LeafMap = new Map()) {
  if (typeof value === "string") {
    result.set(path, value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      stringLeaves(item, `${path}[${index}]`, result);
    });
    return result;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      stringLeaves(child, path ? `${path}.${key}` : key, result);
    }
  }
  return result;
}

function protectedTokens(value: string): string[] {
  return (
    value.match(
      /\{\{[^{}]+\}\}|\{[A-Za-z][A-Za-z0-9_]*\}|<[^>\n]+>|\$\d+|nj_[A-Za-z0-9_-]+|pack\.[A-Za-z0-9_.]+/g,
    ) ?? []
  ).sort();
}

const launchDictionaries: Array<[string, Dict]> = [
  ["zh-TW", zhTW],
  ["ja-JP", jaJP],
  ["th-TH", thTH],
];

/**
 * `zh` is the authoring source, not a shipping locale — the product dropped
 * Simplified Chinese. It stays in the catalog checks so the source it is
 * diffed against keeps satisfying the same structural contracts.
 */
const allDictionaries: Array<[string, Dict]> = [
  ["zh (source)", zh],
  ["zh-TW", zhTW],
  ["ja-JP", jaJP],
  ["th-TH", thTH],
  ["en", en],
];

describe("phase-one dictionaries", () => {
  const source = stringLeaves(zh);

  for (const [locale, dictionary] of launchDictionaries) {
    test(`${locale} mirrors every source leaf`, () => {
      const target = stringLeaves(dictionary);
      expect([...target.keys()].sort()).toEqual([...source.keys()].sort());
      for (const [path, value] of target) {
        if ((source.get(path) ?? "").trim().length > 0) {
          expect(value.trim().length, `${locale}:${path}`).toBeGreaterThan(0);
        }
      }
    });

    test(`${locale} preserves placeholders and structural tokens`, () => {
      const target = stringLeaves(dictionary);
      for (const [path, sourceValue] of source) {
        expect(
          protectedTokens(target.get(path) ?? ""),
          `${locale}:${path}`,
        ).toEqual(protectedTokens(sourceValue));
      }
    });
  }
});

describe("localized catalog samples", () => {
  for (const [locale, dictionary] of allDictionaries) {
    test(`${locale} keeps character tag labels aligned to canonical values`, () => {
      const localized = localizeCharacterTagOptions(
        dictionary.characterTagLabels,
      );
      expect(dictionary.characterTagLabels).toHaveLength(
        CHARACTER_TAG_OPTIONS.length,
      );
      expect(localized.map(({ value }) => value)).toEqual([
        ...CHARACTER_TAG_OPTIONS,
      ]);
      expect(localized.every(({ label }) => label.trim().length > 0)).toBe(
        true,
      );
      expect(localizeCharacterTag("creator custom tag", [])).toBe(
        "creator custom tag",
      );
    });

    test(`${locale} preserves the phone sample protocol`, () => {
      const lines = dictionary.characterForm.sandboxPhoneSampleText.split("\n");
      expect(lines).toHaveLength(16);
      expect(lines[0]).toBe("<phone>");
      expect(lines[1]).toBe("[wechat]");
      expect(lines[2]?.startsWith("user: ")).toBe(true);
      expect(lines[2]?.split("|||")).toHaveLength(2);
      expect(lines[3]?.startsWith("ai: ")).toBe(true);
      expect(lines[3]?.split("|||")).toHaveLength(3);
      expect(lines[4]).toBe("[notes]");
      for (const index of [5, 6, 7]) {
        expect(lines[index]?.split("|"), `notes line ${index}`).toHaveLength(3);
      }
      expect(lines[8]).toBe("[wallet]");
      expect(lines[9]?.split("|")).toHaveLength(4);
      expect(lines[9]?.endsWith("|red")).toBe(true);
      expect(lines[10]?.split("|")).toHaveLength(4);
      expect(lines[10]?.endsWith("|blue")).toBe(true);
      expect(lines[11]?.split("|")).toHaveLength(4);
      expect(lines[11]?.endsWith("|gray")).toBe(true);
      expect(lines[12]).toBe("[weibo]");
      for (const index of [13, 14]) {
        expect(lines[index]?.split("|"), `weibo line ${index}`).toHaveLength(4);
      }
      expect(lines[15]).toBe("</phone>");
    });

    test(`${locale} has six aligned pack preview samples`, () => {
      expect(dictionary.packs.studioPreviewDefaultSampleTexts).toHaveLength(6);
      expect(dictionary.packs.studioPreviewDefaultSampleCaptions).toHaveLength(
        6,
      );
    });
  }
});
