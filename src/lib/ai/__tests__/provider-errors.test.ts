import { describe, expect, test } from "bun:test";
import { isPromptPolicyRejection } from "@/lib/ai/provider-errors";

describe("isPromptPolicyRejection", () => {
  test("recognizes the Gemini relay sensitive-prompt error", () => {
    expect(
      isPromptPolicyRejection(
        new Error(
          "The prompt contains sensitive words that violate Google's Generative AI Prohibited Use policy.",
        ),
      ),
    ).toBe(true);
  });

  test("does not misclassify provider availability errors", () => {
    expect(isPromptPolicyRejection(new Error("Service Unavailable"))).toBe(
      false,
    );
    expect(isPromptPolicyRejection(new Error("Rate limit exceeded"))).toBe(
      false,
    );
  });
});
