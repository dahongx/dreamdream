import { expect, test } from "bun:test";
import {
  openingNarrativeText,
  openingsShareNarrative,
} from "../import/mufy-opening-comparison";
test("wrapping and stylesheet changes can be synced without calling narrative different", () => {
  const story = "人物回到家里，故事仍然是同一个。".repeat(20);
  expect(
    openingsShareNarrative(
      `<style>.old{color:red}</style><div>${story}</div>`,
      `<article>${story}</article>`,
    ),
  ).toBe(true);
});
test("different story or a trivial short string is not an identity proof", () => {
  expect(openingsShareNarrative("你好", "你好")).toBe(false);
  expect(openingsShareNarrative("高中".repeat(60), "大学".repeat(60))).toBe(
    false,
  );
});
test("scripts are never executed and known entities are normalized", () => {
  expect(
    openingNarrativeText("<script>alert(1)</script><p>A&nbsp;&amp; B</p>"),
  ).toBe("A&B");
});
