import { describe, expect, test } from "bun:test";
import {
  appendResponseVariationCue,
  buildResponseVariationCue,
} from "@/lib/ai/response-variation";

describe("response variation cue", () => {
  test("changes with the per-request key without changing the player turn", () => {
    const first = appendResponseVariationCue("玩家原文", { key: "alpha" });
    const second = appendResponseVariationCue("玩家原文", { key: "beta" });

    expect(first.startsWith("玩家原文\n\n")).toBe(true);
    expect(first).not.toBe(second);
    expect(first).toContain("variation_key: alpha");
    expect(second).toContain("variation_key: beta");
  });

  test("regenerate changes direction without quoting rejected content", () => {
    const cue = buildResponseVariationCue({
      key: "reroll",
      mode: "regenerate",
    });

    expect(cue).toContain("Produce a materially different answer");
    expect(cue).toContain("variation_direction:");
    expect(cue).not.toContain("REJECTED_CANDIDATE");
  });

  test("uses a stable direction for the same request key", () => {
    const first = buildResponseVariationCue({
      key: "same",
      mode: "regenerate",
    });
    const second = buildResponseVariationCue({
      key: "same",
      mode: "regenerate",
    });

    expect(first).toBe(second);
  });
});
