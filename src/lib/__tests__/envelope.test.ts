import { describe, expect, test } from "bun:test";
import { normalizeReplacementEnvelope } from "@/lib/regex/envelope";
import { regexRuleFormSchema } from "@/lib/regex/schema";

describe("normalizeReplacementEnvelope", () => {
  test("rewrites ```html ... ``` fence into <artifact> envelope", () => {
    const input = "```html\n<script>console.log(1)</script>\n```";
    expect(normalizeReplacementEnvelope(input)).toBe(
      "<artifact><script>console.log(1)</script></artifact>",
    );
  });

  test("tolerates CRLF line endings (paste from Windows / clipboard)", () => {
    const input = "```html\r\n<style>.x{}</style>\r\n```";
    expect(normalizeReplacementEnvelope(input)).toBe(
      "<artifact><style>.x{}</style></artifact>",
    );
  });

  test("tolerates leading/trailing whitespace around the outer fence", () => {
    const input = "   ```html\n<div>hi</div>\n```   ";
    expect(normalizeReplacementEnvelope(input)).toBe(
      "<artifact><div>hi</div></artifact>",
    );
  });

  test("accepts a bare ``` fence with no language tag", () => {
    const input = "```\n<div>hi</div>\n```";
    expect(normalizeReplacementEnvelope(input)).toBe(
      "<artifact><div>hi</div></artifact>",
    );
  });

  test("leaves an already-wrapped <artifact> envelope alone", () => {
    const input = "<artifact><div>hi</div></artifact>";
    expect(normalizeReplacementEnvelope(input)).toBe(input);
  });

  test("leaves plain HTML without an outer fence alone", () => {
    const input = '<div class="nj_status">$1</div>';
    expect(normalizeReplacementEnvelope(input)).toBe(input);
  });

  test("does not unwrap when the body contains another ``` (would be ambiguous)", () => {
    const input = "```html\nbefore\n```inner```\nafter\n```";
    expect(normalizeReplacementEnvelope(input)).toBe(input);
  });

  test("leaves empty string alone", () => {
    expect(normalizeReplacementEnvelope("")).toBe("");
  });
});

describe("regexRuleFormSchema replacement transform", () => {
  test("normalizes fenced replacement on parse", () => {
    const formData = {
      name: "test",
      pattern: "<mem>(.*?)</mem>",
      replacement: "```html\n<script>x</script>\n```",
    };
    const parsed = regexRuleFormSchema.parse(formData);
    expect(parsed.replacement).toBe("<artifact><script>x</script></artifact>");
  });

  test("passes through artifact-wrapped replacement unchanged", () => {
    const formData = {
      name: "test",
      pattern: "<mem>(.*?)</mem>",
      replacement: "<artifact><div>hi</div></artifact>",
    };
    const parsed = regexRuleFormSchema.parse(formData);
    expect(parsed.replacement).toBe("<artifact><div>hi</div></artifact>");
  });
});
