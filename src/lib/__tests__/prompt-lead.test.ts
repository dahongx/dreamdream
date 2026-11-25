import { describe, expect, test } from "bun:test";
import { buildPromptLeadMessages } from "@/lib/ai/prompt-lead";

describe("buildPromptLeadMessages", () => {
  test("uses one canonical first-user prompt when history starts with assistant", () => {
    const messages = buildPromptLeadMessages({
      systemPrompt: "MASTER_PROMPT",
      firstConversationRole: "assistant",
      useAnthropicCache: false,
      responseLocale: "zh-Hans",
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("user");
    expect(messages[0]?.content).toEqual([
      { type: "text", text: "MASTER_PROMPT" },
    ]);
  });

  test("adds an assistant acknowledgement before a user-first history", () => {
    const messages = buildPromptLeadMessages({
      systemPrompt: "MASTER_PROMPT",
      firstConversationRole: "user",
      useAnthropicCache: false,
      responseLocale: "ja-JP",
    });
    expect(messages.map(({ role }) => role)).toEqual(["user", "assistant"]);
    expect(messages[1]?.content).toBe(
      "承知しました。設定に従ってロールプレイを開始します。",
    );
  });

  test("keeps the Anthropic cache breakpoint on the prompt text", () => {
    const [prompt] = buildPromptLeadMessages({
      systemPrompt: "MASTER_PROMPT",
      firstConversationRole: "assistant",
      useAnthropicCache: true,
      responseLocale: "th-TH",
    });
    expect(prompt).toMatchObject({
      role: "user",
      content: [
        {
          type: "text",
          text: "MASTER_PROMPT",
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
      ],
    });
  });
});
