import { describe, expect, test } from "bun:test";
import { sanitizeHtml } from "@/lib/sanitize";

/**
 * 这套测试只锁渲染契约里"语义标签"那一面 —— 它们必须穿过 DOMPurify
 * 不被剥光，否则 react-markdown 的 components map 就拿不到东西去路由。
 *
 * DOMPurify 的 default 会把未知 inline 标签直接 unwrap（保留 children、
 * 删 element），所以 ADD_TAGS 那行任何一项掉了，这里都会立刻挂。
 */

describe("sanitizeHtml — semantic tag allowlist", () => {
  test("preserves <message>/<mes> for AIBubble routing", () => {
    expect(sanitizeHtml("<message>嗨</message>")).toContain("<message>");
    expect(sanitizeHtml("<mes>嗨</mes>")).toContain("<mes>");
  });

  test("preserves <user>/<usr> for UserBubbleFromTag routing", () => {
    // 「谢寻」开场白回归 case：作者用 <user> 包玩家预设台词，
    // 不能被 sanitize 剥成裸文本，否则就退化成 fallback 进 AIBubble。
    expect(sanitizeHtml("<user>项链很好看，谢谢老公。</user>")).toContain(
      "<user>",
    );
    expect(sanitizeHtml("<usr>嗯。</usr>")).toContain("<usr>");
  });

  test("preserves <narration>/<nar>, <system>/<sys>, <scenario>/<sce>, <think>, <artifact>", () => {
    const out = sanitizeHtml(
      "<narration>x</narration><nar>x</nar><system>x</system><sys>x</sys><scenario>x</scenario><sce>x</sce><think>x</think><artifact></artifact>",
    );
    for (const tag of [
      "<narration>",
      "<nar>",
      "<system>",
      "<sys>",
      "<scenario>",
      "<sce>",
      "<think>",
      "<artifact>",
    ]) {
      expect(out).toContain(tag);
    }
  });
});

describe("sanitizeHtml — dangerous tag guard still applies", () => {
  test("strips <script>", () => {
    const out = sanitizeHtml("<message>ok</message><script>alert(1)</script>");
    expect(out).toContain("<message>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  test("strips <iframe>", () => {
    expect(sanitizeHtml('<iframe src="evil"></iframe>')).not.toContain(
      "<iframe",
    );
  });
});
