import { describe, expect, test } from "bun:test";
import { extractGeminiFilterDiagnostics } from "../gemini-filter-diagnostics";

describe("extractGeminiFilterDiagnostics", () => {
  test("keeps raw reason, finish message and sanitized safety ratings", () => {
    expect(
      extractGeminiFilterDiagnostics("PROHIBITED_CONTENT", {
        google: {
          finishMessage: "  blocked\nby policy  ",
          safetyRatings: [
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              probability: "HIGH",
              probabilityScore: 0.98,
              severity: "MEDIUM",
              severityScore: 0.6,
              blocked: true,
              ignoredProviderField: "secret",
            },
          ],
        },
      }),
    ).toEqual({
      rawFinishReason: "PROHIBITED_CONTENT",
      finishMessage: "blocked by policy",
      safetyRatings: [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          probability: "HIGH",
          probabilityScore: 0.98,
          severity: "MEDIUM",
          severityScore: 0.6,
          blocked: true,
        },
      ],
    });
  });

  test("supports a provider-specific metadata key", () => {
    const diagnostics = extractGeminiFilterDiagnostics("SAFETY", {
      "google.generative-ai": { safetyRatings: [], finishMessage: null },
    });
    expect(diagnostics.rawFinishReason).toBe("SAFETY");
    expect(diagnostics.safetyRatings).toEqual([]);
  });

  test("never copies prompt, response text, or unknown metadata", () => {
    const diagnostics = extractGeminiFilterDiagnostics("SAFETY", {
      google: {
        prompt: "private prompt",
        responseBody: "private response",
        unrelated: { content: "private content" },
      },
    });
    expect(JSON.stringify(diagnostics)).not.toContain("private");
  });
});
