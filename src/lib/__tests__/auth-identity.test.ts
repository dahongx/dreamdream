import { describe, expect, test } from "bun:test";
import { USERNAME_RE } from "@/lib/auth/identity";

describe("international usernames", () => {
  test("accepts phase-one scripts and combining marks", () => {
    for (const username of [
      "小雨",
      "ユキ",
      "ゆき_7",
      "ณิชา",
      "ผู้เล่น9",
      "mio-7",
    ]) {
      expect(USERNAME_RE.test(username)).toBe(true);
    }
  });

  test("rejects whitespace, punctuation, and out-of-range lengths", () => {
    for (const username of ["a", "two words", "name!", "x".repeat(33)]) {
      expect(USERNAME_RE.test(username)).toBe(false);
    }
  });
});
