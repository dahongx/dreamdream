import type { ModelMessage } from "ai";
import type { ConversationLocale } from "./conversation-locale";

const PROMPT_ACKNOWLEDGEMENTS: Record<ConversationLocale, string> = {
  "zh-Hans": "明白。我会遵循以上配置并开始角色扮演。",
  "zh-Hant": "明白。我會遵循以上設定並開始角色扮演。",
  en: "Understood. I will follow the configuration and begin the roleplay.",
  "ja-JP": "承知しました。設定に従ってロールプレイを開始します。",
  "th-TH": "รับทราบ จะทำตามการตั้งค่าและเริ่มโรลเพลย์",
};

interface PromptLeadInput {
  systemPrompt: string;
  firstConversationRole: ModelMessage["role"] | undefined;
  useAnthropicCache: boolean;
  responseLocale: ConversationLocale;
}

/**
 * The captured upstream requests do not preserve whether the template originally
 * travelled as a provider system instruction or as the first user frame.
 * Dearm standardizes on the already-proven first-user-frame contract for both
 * new replies and continuations so the same canonical prompt has identical
 * message-role semantics on both paths.
 */
export function buildPromptLeadMessages({
  systemPrompt,
  firstConversationRole,
  useAnthropicCache,
  responseLocale,
}: PromptLeadInput): ModelMessage[] {
  const promptMessage: ModelMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: systemPrompt,
        ...(useAnthropicCache
          ? {
              providerOptions: {
                anthropic: { cacheControl: { type: "ephemeral" } },
              },
            }
          : {}),
      },
    ],
  };

  if (firstConversationRole === "assistant") return [promptMessage];
  return [
    promptMessage,
    {
      role: "assistant",
      content: PROMPT_ACKNOWLEDGEMENTS[responseLocale],
    },
  ];
}
