import { describe, expect, test } from "bun:test";
import {
  extractModelMessageText,
  MASK_INSTRUCTION_HEADING,
  OOC_CONVENTION_HEADER,
  TRAILING_FORMAT_REMINDER,
  wrapPlayerTurn,
} from "@/lib/ai/player-turn";

const ctx = { char: "托斯卡", user: "南安" };

const mask = {
  name: "南安",
  gender: "男",
  description: "干净清爽，狐狸眼",
  preference: "喜欢被温柔对待",
  instruction: "$所有记忆叠加记录禁止合并\n$每次回复都禁止扮演南安",
};

/**
 * 结构断言全部显式钉 zh-Hans —— OOC_CONVENTION_HEADER 等导出常量就是这一套简中文案。
 * 站点默认语言已改繁中（wrapPlayerTurn 的 locale 默认值同步成 zh-Hant），不显式传就
 * 会拿到繁中副本。会话语言的分支覆盖在下方「每轮包装跟随…」那条里。
 */
describe("wrapPlayerTurn", () => {
  test("含 OOC 约定头 / 面具块 / $指令 / 📝 标记 / 尾部提醒", () => {
    const out = wrapPlayerTurn("（我按着你开始）", mask, ctx, "zh-Hans");
    expect(out).toContain(OOC_CONVENTION_HEADER);
    expect(out).toContain("姓名：南安");
    expect(out).toContain("性别：男");
    expect(out).toContain("南安的描述：干净清爽，狐狸眼");
    expect(out).toContain("南安的喜好：喜欢被温柔对待");
    expect(out).toContain("$所有记忆叠加记录禁止合并");
    expect(out).toContain("📝 玩家剧情/台词输入：");
    expect(out).toContain(TRAILING_FORMAT_REMINDER);
  });

  test("段落顺序：约定头 → 面具块 → 📝 台词 → 尾部提醒", () => {
    const out = wrapPlayerTurn("台词内容", mask, ctx, "zh-Hans");
    const iHeader = out.indexOf("注意：玩家使用");
    const iMask = out.indexOf("姓名：南安");
    const iMarker = out.indexOf("📝 玩家剧情/台词输入：");
    const iText = out.indexOf("台词内容");
    const iTrailing = out.indexOf("如果玩家的番外请求正常");
    expect(iHeader).toBeLessThan(iMask);
    expect(iMask).toBeLessThan(iMarker);
    expect(iMarker).toBeLessThan(iText);
    expect(iText).toBeLessThan(iTrailing);
  });

  test("{{user}} 占位插值成面具名", () => {
    const out = wrapPlayerTurn("玩家台词", mask, ctx, "zh-Hans");
    // 面具块用「{{user}}的描述」标签，interpolate 后落成 ctx.user（南安）
    expect(out).toContain("南安的描述：");
    expect(out).not.toContain("{{user}}");
  });

  test("内联 $.../(...) 原样保留，不剥离", () => {
    const raw = "（我抱着你）$禁止输出“极其” ($隐私模式开启)";
    const out = wrapPlayerTurn(raw, mask, ctx, "zh-Hans");
    expect(out).toContain(raw);
  });

  test("无面具：降级为 约定头 + 📝 + 台词 + 尾部（无面具块）", () => {
    const out = wrapPlayerTurn("台词", null, ctx, "zh-Hans");
    expect(out).toContain(OOC_CONVENTION_HEADER);
    expect(out).toContain("📝 玩家剧情/台词输入：");
    expect(out).toContain("台词");
    expect(out).toContain(TRAILING_FORMAT_REMINDER);
    expect(out).not.toContain("姓名：");
  });

  test("面具仅有名字时只出现 姓名 行", () => {
    const out = wrapPlayerTurn(
      "台词",
      {
        name: "阿月",
        gender: null,
        description: null,
        preference: null,
        instruction: null,
      },
      ctx,
      "zh-Hans",
    );
    expect(out).toContain("姓名：阿月");
    expect(out).not.toContain("性别：");
    expect(out).not.toContain("的描述：");
  });

  test("$指令 独立成块、带常驻标注、位于人设块与台词标记之间", () => {
    const out = wrapPlayerTurn("台词", mask, ctx, "zh-Hans");
    expect(out).toContain(MASK_INSTRUCTION_HEADING);
    const iPersona = out.indexOf("南安的喜好：");
    const iHeading = out.indexOf(MASK_INSTRUCTION_HEADING);
    const iInstr = out.indexOf("$所有记忆叠加记录禁止合并");
    const iMarker = out.indexOf("📝 玩家剧情/台词输入：");
    expect(iPersona).toBeLessThan(iHeading);
    expect(iHeading).toBeLessThan(iInstr);
    expect(iInstr).toBeLessThan(iMarker);
  });

  test("无 $指令 时不出现常驻指令标注", () => {
    const out = wrapPlayerTurn(
      "台词",
      {
        name: "阿月",
        gender: null,
        description: null,
        preference: null,
        instruction: null,
      },
      ctx,
      "zh-Hans",
    );
    expect(out).not.toContain(MASK_INSTRUCTION_HEADING);
  });

  test("每轮包装跟随繁中、日语、泰语和英语会话语言", () => {
    const cases = [
      ["zh-Hant", "📝 玩家劇情／台詞輸入："],
      ["ja-JP", "📝 プレイヤーの行動／台詞："],
      ["th-TH", "📝 การกระทำ / บทพูดของผู้เล่น:"],
      ["en", "📝 Player action / dialogue input:"],
    ] as const;

    for (const [locale, marker] of cases) {
      const out = wrapPlayerTurn("hello", null, ctx, locale);
      expect(out).toContain(marker);
      expect(out).toContain("Greeting");
      expect(out).toContain("OutputSetting");
      expect(out).not.toContain("📝 玩家剧情/台词输入：");
    }
  });
});

describe("extractModelMessageText", () => {
  test("string content passes through", () => {
    expect(extractModelMessageText("hello")).toBe("hello");
  });

  test("concatenates text parts, ignores non-text", () => {
    expect(
      extractModelMessageText([
        { type: "text", text: "你好" },
        { type: "image", image: "x" },
        { type: "text", text: "世界" },
      ]),
    ).toBe("你好世界");
  });

  test("returns empty string for unknown shapes", () => {
    expect(extractModelMessageText(null)).toBe("");
    expect(extractModelMessageText(42)).toBe("");
  });
});
