import { describe, expect, test } from "bun:test";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { providerOptionsByModelId } from "@/lib/ai/provider";

describe("providerOptionsByModelId", () => {
  test("defaults to Claude Sonnet 4.6", () => {
    expect(DEFAULT_MODEL_ID).toBe("claude-sonnet-4-6");
  });

  test("disables thinking for DeepSeek models", () => {
    expect(providerOptionsByModelId("deepseek-ai/DeepSeek-V4-Pro")).toEqual({
      anthropic: { thinking: { type: "disabled" } },
    });
  });

  test("does not add provider options for Claude models", () => {
    expect(providerOptionsByModelId("claude-sonnet-4-6")).toBeUndefined();
  });

  // Gemini 全部走 OpenAI-compat 中转（NewAPI）—— google.safetySettings /
  // google.thinkingConfig 无法透传，一律返回 undefined。此前的
  // NIMIR_GEMINI_THINKING_LEVEL / NIMIR_GEMINI_THINKING_BUDGET 环境变量
  // 在此路径下失效（env 名保留以便日后回切原生零改动）。
  test("returns undefined for Gemini models (OpenAI-compat routing)", () => {
    expect(providerOptionsByModelId("gemini-3.1-pro-preview")).toBeUndefined();
    expect(providerOptionsByModelId("gemini-3-flash")).toBeUndefined();
    expect(providerOptionsByModelId("gemini-3.5-flash")).toBeUndefined();
  });
});
