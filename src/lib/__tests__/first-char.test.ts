import { describe, expect, test } from "bun:test";
import { firstChar } from "@/lib/util/first-char";

describe("firstChar", () => {
  test("returns first Han char", () => {
    expect(firstChar("苏然")).toBe("苏");
  });

  test("returns first latin char", () => {
    expect(firstChar("Maat")).toBe("M");
  });

  test("returns whole emoji, not the broken surrogate half", () => {
    // 🍎 = U+1F34E, a 4-byte char (two UTF-16 code units)
    expect(firstChar("🍎 apple")).toBe("🍎");
    expect(firstChar("🍎 apple").length).toBeGreaterThan(1);
  });

  test("returns whole Han Extension B glyph", () => {
    // 𠈤 = U+20224, also outside the BMP
    expect(firstChar("𠈤宝")).toBe("𠈤");
  });

  test('returns "?" on empty / null / undefined', () => {
    expect(firstChar("")).toBe("?");
    expect(firstChar(null)).toBe("?");
    expect(firstChar(undefined)).toBe("?");
  });

  test("ignores leading whitespace by character, not trimming", () => {
    // We deliberately don't trim — caller can pass a trimmed name
    expect(firstChar(" Maat")).toBe(" ");
  });
});
