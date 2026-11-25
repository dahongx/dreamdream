import { describe, expect, test } from "bun:test";
import { stripEmbeddedUserTurns } from "@/lib/ai/embedded-user-turns";

describe("stripEmbeddedUserTurns", () => {
  test("removes a completed player turn from an assistant reply", () => {
    expect(
      stripEmbeddedUserTurns(
        "风吹过草原。\n\n<user>我看谁敢！</user>\n\n公仪晢勒住缰绳。",
      ),
    ).toBe("风吹过草原。\n\n公仪晢勒住缰绳。");
  });

  test("removes the usr alias and multiple embedded turns", () => {
    expect(
      stripEmbeddedUserTurns(
        "前文\n<usr>第一句</usr>\n中段\n<user>第二句</user>\n后文",
      ),
    ).toBe("前文\n中段\n后文");
  });

  test("hides an unterminated player turn while streaming", () => {
    expect(stripEmbeddedUserTurns("正文\n\n<user>正在逐字生成")).toBe(
      "正文\n\n",
    );
  });

  test("leaves unrelated semantic tags untouched", () => {
    const source = "<narration>雨停了。</narration><message>过来。</message>";
    expect(stripEmbeddedUserTurns(source)).toBe(source);
  });
});
