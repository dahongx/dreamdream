import { describe, expect, test } from "bun:test";
import { prepareChatHistory } from "@/lib/chat/history-messages";

type TestMessage = {
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
  metadata?: { safetyBlocked?: boolean; stoppedByUser?: boolean };
};

function message(
  role: TestMessage["role"],
  text: string,
  safetyBlocked = false,
): TestMessage {
  return {
    role,
    parts: [{ type: "text", text }],
    metadata: safetyBlocked ? { safetyBlocked: true } : undefined,
  };
}

describe("prepareChatHistory", () => {
  test("does not echo a historical stop-labelled refusal, retaining turn order", () => {
    const refusal =
      "我无法参与包含浪漫、亲密关系或虚构恋爱桥段的互动与文学创作。";
    const result = prepareChatHistory([
      message("user", "你好"),
      message("assistant", refusal),
      message("user", "接着聊"),
    ]);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(result[1].parts[0].text).not.toContain("无法参与");
  });
  test("keeps a visible safety-truncated reply between user turns", () => {
    const result = prepareChatHistory([
      message("user", "first"),
      message("assistant", "partial reply", true),
      message("user", "second"),
    ]);

    expect(result.map((item) => item.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
  });

  test("keeps multiple visible truncated replies so prompts never collapse", () => {
    const result = prepareChatHistory([
      message("user", "u1"),
      message("assistant", "a1 partial", true),
      message("user", "u2"),
      message("assistant", "a2 partial", true),
      message("user", "u3"),
    ]);

    expect(result).toHaveLength(5);
    expect(result.map((item) => item.role).join("-")).toBe(
      "user-assistant-user-assistant-user",
    );
  });

  test("drops an empty safety placeholder", () => {
    const result = prepareChatHistory([
      message("user", "first"),
      message("assistant", "   ", true),
      message("user", "second"),
    ]);

    expect(result.map((item) => item.role)).toEqual(["user", "user"]);
  });

  test("does not alter normal messages", () => {
    const input = [message("user", "hello"), message("assistant", "complete")];

    expect(prepareChatHistory(input)).toEqual(input);
  });

  test("replaces a stopped draft but preserves assistant role alternation", () => {
    const stopped = message("assistant", "rejected partial reply");
    stopped.metadata = { stoppedByUser: true };

    const result = prepareChatHistory([
      message("user", "first"),
      stopped,
      message("user", "try something else"),
    ]);

    expect(result.map((item) => item.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(result[1].parts[0].text).not.toContain("rejected partial reply");
    expect(result[1].parts[0].text).toContain("stopped");
  });
});
