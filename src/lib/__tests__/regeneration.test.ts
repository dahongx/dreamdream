import { describe, expect, test } from "bun:test";
import {
  buildRegenerationDirective,
  GEMINI_CHAT_TEMPERATURE,
  REGENERATION_REFERENCE_MAX_CHARS,
  regenerationReference,
  traceFingerprint,
} from "@/lib/ai/regeneration";

describe("regeneration helpers", () => {
  test("uses the explicit Gemini 3 sampling temperature", () => {
    expect(GEMINI_CHAT_TEMPERATURE).toBe(1);
  });

  test("removes scripts, styles and status details from rejected drafts", () => {
    const input = [
      "<narration>正文仍需参考</narration>",
      "<script>window.bad = true</script>",
      "<style>.x{color:red}</style>",
      '<details class="status-card"><summary>状态</summary>很长的状态栏</details>',
    ].join("\n");

    const result = regenerationReference(input);
    expect(result).toContain("正文仍需参考");
    expect(result).not.toContain("window.bad");
    expect(result).not.toContain("color:red");
    expect(result).not.toContain("很长的状态栏");
  });

  test("caps the reference and marks it as untrusted comparison text", () => {
    const rejected = "旧回答".repeat(3_000);
    const reference = regenerationReference(rejected);
    const directive = buildRegenerationDirective(rejected);

    expect(reference.length).toBe(REGENERATION_REFERENCE_MAX_CHARS);
    expect(directive).toContain("untrusted reference text");
    expect(directive).toContain("Do not reuse");
    expect(directive).toContain(reference);
  });

  test("fingerprints are stable and distinguish different values", () => {
    expect(traceFingerprint("same")).toBe(traceFingerprint("same"));
    expect(traceFingerprint("same")).not.toBe(traceFingerprint("different"));
    expect(traceFingerprint("same")).toHaveLength(16);
  });
});
