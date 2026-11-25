import { describe, expect, test } from "bun:test";
import {
  createSuggestionCache,
  parseSuggestions,
  REPLY_SUGGESTION_INSTRUCTION,
  storyText,
  suggestionHistory,
  suggestionRequestSchema,
} from "../reply-suggestions";

const answers = [
  "我把热茶递给你。",
  "今天去公园走走吧。",
  "先告诉我发生了什么？",
];
describe("reply suggestions", () => {
  test("prompt asks for scene-grounded distinct player turns, not mandatory one-liners", () => {
    expect(REPLY_SUGGESTION_INSTRUCTION).toContain("mini-turn");
    expect(REPLY_SUGGESTION_INSTRUCTION).toContain("differ in intent");
    expect(REPLY_SUGGESTION_INSTRUCTION).toContain(
      "Do not invent major past events",
    );
    expect(REPLY_SUGGESTION_INSTRUCTION).not.toContain(
      "Each alternative is a short line",
    );
    const detailed = [
      "（我将茶杯拢在掌心，指尖慢慢暖过来。）“再坐一会儿吧，雨才刚停。你刚才说还有事，陪我等到现在，会不会耽误你？”",
      "（我看了眼门边收好的伞，又抬头望向你。）“出去走走也好。不过地上都是水，你走慢一点，我可不想再淋湿鞋子。”",
      "（我轻轻碰了碰杯沿，没有立刻起身。）“这么会照顾人，还要故意说我逞强。你自己呢，站了这么久，要不要也喝一点？”",
    ];
    expect(parseSuggestions(JSON.stringify(detailed))).toEqual(detailed);
  });
  test("accepts only a server-owned session ID, no injected history/model", () => {
    expect(
      suggestionRequestSchema.safeParse({
        sessionId: "e948756e-7f63-4c98-9f68-f513d833a585",
      }).success,
    ).toBe(true);
    expect(
      suggestionRequestSchema.safeParse({ sessionId: "bad" }).success,
    ).toBe(false);
    expect(
      suggestionRequestSchema.safeParse({
        sessionId: "e948756e-7f63-4c98-9f68-f513d833a585",
        model: "expensive",
      }).success,
    ).toBe(false);
  });
  test("requires three distinct complete plain-text replies", () => {
    expect(parseSuggestions(JSON.stringify(answers))).toEqual(answers);
    expect(
      parseSuggestions(
        `\x60\x60\x60json\n${JSON.stringify(answers)}\n\x60\x60\x60`,
      ),
    ).toEqual(answers);
    for (const invalid of [
      "refusal",
      '["one",',
      JSON.stringify(answers.slice(1)),
      JSON.stringify(["same", "same", "other"]),
      JSON.stringify(["<b>hello</b>", "other", "third"]),
      JSON.stringify(["a".repeat(241), "other", "third"]),
    ]) {
      expect(() => parseSuggestions(invalid)).toThrow();
    }
  });
  test("removes scripts/styles/thoughts and bounds recent context", () => {
    expect(
      storyText(
        "<style>secret css</style><script>alert(1)</script><think>private reasoning</think><p>喝茶</p>",
      ),
    ).toBe("喝茶");
    const rows = Array.from({ length: 30 }, (_, i) => ({
      role: "assistant",
      content: `${i}:${"茶".repeat(4000)}`,
    }));
    const history = suggestionHistory(rows);
    expect(history.length).toBe(4);
    expect(history.reduce((sum, row) => sum + row.text.length, 0)).toBe(12000);
    expect(
      suggestionHistory([
        { role: "user", content: "第一句" },
        { role: "assistant", content: "第二句" },
      ]).map((r) => r.text),
    ).toEqual(["第一句", "第二句"]);
  });
  test("deduplicates in-flight requests; expiry and context changes generate again", async () => {
    let now = 0;
    let calls = 0;
    const cache = createSuggestionCache(() => now);
    const generate = async () => {
      calls++;
      return answers;
    };
    await Promise.all([
      cache.get("user-a:context1", generate),
      cache.get("user-a:context1", generate),
    ]);
    await cache.get("user-a:context1", generate);
    expect(calls).toBe(1);
    await cache.get("user-b:context1", generate);
    await cache.get("user-a:edited-context", generate);
    expect(calls).toBe(3);
    now = 300001;
    await cache.get("user-a:context1", generate);
    expect(calls).toBe(4);
  });
  test("does not cache errors or hold a failed single-flight lock", async () => {
    const cache = createSuggestionCache();
    await expect(
      cache.get("key", async () => {
        throw new Error("upstream down");
      }),
    ).rejects.toThrow();
    expect(await cache.get("key", async () => answers)).toEqual(answers);
  });
});
