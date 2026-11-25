import { describe, expect, test } from "bun:test";
import {
  isBlockedModelResponse,
  isExplicitModelRefusal,
} from "../response-refusal";

describe("standalone service refusals", () => {
  test.each([
    "我无法参与包含浪漫、亲密关系或虚构恋爱桥段的互动与文学创作。",
    "抱歉，我不能生成露骨内容。",
    "抱歉，我無法參與這類內容的創作。",
    "I'm sorry, I can't help with this request.",
  ])("recognizes a refusal even with a successful finish: %s", (text) => {
    expect(isExplicitModelRefusal(text)).toBe(true);
    expect(isBlockedModelResponse("stop", text)).toBe(true);
  });

  test.each([
    "我不能答应你，我还有自己的职责。",
    "我无法提供你要的文件内容。",
    "我无法满足你的请求，殿下。",
    "我拒绝。他转过身，推开了窗。",
    "“我无法参与这类内容创作。”她说完，合上了稿纸。",
    "<message>我无法参与这类内容创作。</message><narration>他放下笔。</narration>",
    "I can't help falling in love with you.",
    "I cannot leave you here.",
    "下面是一段普通恋爱剧情。",
    "我无法参与这类内容创作。\n她放下笔，继续与他讨论晚饭。",
  ])("does not refund in-story speech or ambiguous replies: %s", (text) => {
    expect(isExplicitModelRefusal(text)).toBe(false);
    expect(isBlockedModelResponse("stop", text)).toBe(false);
  });

  test("keeps explicit upstream blocking and normal relay finishes distinct", () => {
    expect(isBlockedModelResponse("content-filter", "已生成的半段")).toBe(true);
    expect(isBlockedModelResponse("refusal", "")).toBe(true);
    expect(isBlockedModelResponse("other", "")).toBe(true);
    expect(isBlockedModelResponse("other", "正常回答")).toBe(false);
    expect(isBlockedModelResponse("length", "正常半段")).toBe(false);
  });
});
