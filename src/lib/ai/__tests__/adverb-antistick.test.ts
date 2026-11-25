import { describe, expect, test } from "bun:test";
import {
  antiStickAdverbs,
  countStickyAdverbs,
  geminiAntiStickPromptSection,
  isPollutedByAdverbs,
  stripStatusCards,
} from "@/lib/ai/adverb-antistick";

describe("collapseConsecutive — 连续同词折叠", () => {
  test("折叠三连以上的同一副词", () => {
    const { text, changed } = antiStickAdverbs("林家极其极其极其极其彻底完了");
    expect(text).toBe("林家极其彻底完了");
    expect(changed).toBe(true);
  });

  test("折叠两连", () => {
    const { text } = antiStickAdverbs("空气里飘着极其极其淡雅的香气");
    expect(text).toBe("空气里飘着极其淡雅的香气");
  });

  test("不折叠单次出现", () => {
    const src = "空气里飘着极其淡雅的香气";
    const { text, changed } = antiStickAdverbs(src);
    expect(text).toBe(src);
    expect(changed).toBe(false);
  });

  test("多种副词同时污染", () => {
    const { text } = antiStickAdverbs("非常非常非常快，十分十分好");
    expect(text).toBe("非常快，十分好");
  });
});

describe("thinDensePerLine — 段内密集删除", () => {
  test("段内 ≥5 次 → 保留前 2 次", () => {
    const src =
      "极其温柔的话，极其小心的动作，极其漂亮的眼睛，极其干净的手，极其甜的笑";
    const { text } = antiStickAdverbs(src);
    const count = countStickyAdverbs(text);
    expect(count).toBe(2);
    // 前两个位置应保留
    expect(text.startsWith("极其温柔的话，极其小心")).toBe(true);
  });

  test("段内 4 次 → 全部保留（未达密集阈值）", () => {
    const src = "极其温柔，极其小心，极其漂亮，极其干净";
    const { text } = antiStickAdverbs(src);
    expect(countStickyAdverbs(text)).toBe(4);
    expect(text).toBe(src);
  });

  test("换行分段：一段密集不影响另一段少量", () => {
    const denseLine = "极其A，极其B，极其C，极其D，极其E，极其F";
    const sparseLine = "极其安静";
    const { text } = antiStickAdverbs(`${denseLine}\n${sparseLine}`);
    const [line1, line2] = text.split("\n");
    expect(countStickyAdverbs(line1)).toBe(2);
    expect(line2).toBe(sparseLine);
  });

  test("段内某副词密集时只清那个词，其他副词不动", () => {
    const src = "极其A，极其B，极其C，极其D，极其E，非常F";
    const { text } = antiStickAdverbs(src);
    // 极其被清到 2 次；非常保留
    expect((text.match(/极其/g) || []).length).toBe(2);
    expect(text.includes("非常F")).toBe(true);
  });
});

describe("正常文本不误伤", () => {
  test("空字符串", () => {
    const { text, changed, originalCount } = antiStickAdverbs("");
    expect(text).toBe("");
    expect(changed).toBe(false);
    expect(originalCount).toBe(0);
  });

  test("无副词纯叙事", () => {
    const src = "他推开门，看见桌上放着一封信。窗外下着雨。";
    const { text, changed } = antiStickAdverbs(src);
    expect(text).toBe(src);
    expect(changed).toBe(false);
  });

  test("普通强调（每段 ≤2 次） 不动", () => {
    const src = "她极其冷静。他非常紧张。";
    const { text } = antiStickAdverbs(src);
    expect(text).toBe(src);
  });

  test("不覆盖非副词双字（如'很多'）", () => {
    // "很多" 不在词表，不动
    const src = "很多很多的星星";
    const { text } = antiStickAdverbs(src);
    expect(text).toBe(src);
  });
});

describe("图上真实 case 复现", () => {
  test("07-09 谢寻卡截图那段", () => {
    const src =
      "江澈: 兄弟们，林家极其极其极其极其彻底完了。谢董刚才极其极其发话，极其极其极其极其谁敢极其极其极其极其极其帮林家，就是跟极其整个谢家作对。";
    const { text } = antiStickAdverbs(src);
    // 全部折叠 + 段内密集 → 剩下前 2 个
    const count = countStickyAdverbs(text);
    expect(count).toBeLessThanOrEqual(2);
    // 不改变语义骨架
    expect(text.includes("林家")).toBe(true);
    expect(text.includes("完了")).toBe(true);
    expect(text.includes("谢家作对")).toBe(true);
  });
});

describe("stripStatusCards — 剥离状态栏 HTML", () => {
  test('剥掉 <details class="status-card"> 块', () => {
    const src = `叙事正文段。
<details class="status-card">
  <summary>状态</summary>
  <p>极其极其极其</p>
</details>`;
    const out = stripStatusCards(src);
    expect(out.includes("status-card")).toBe(false);
    expect(out.includes("极其极其极其")).toBe(false);
    expect(out.includes("叙事正文段")).toBe(true);
  });

  test("剥掉多个状态栏", () => {
    const src = `A<details class="status-card">x1</details>B<details class="status-card">x2</details>C`;
    const out = stripStatusCards(src);
    expect(out).toBe("ABC");
  });

  test("剥掉 status-wrapper 变体", () => {
    const src = `叙事。<div class="status-wrapper"><details>极其复读</details></div>`;
    const out = stripStatusCards(src);
    expect(out.includes("status-wrapper")).toBe(false);
    expect(out.includes("极其复读")).toBe(false);
  });

  test("status-wrapper 含多个 status-card 时整块剥离且不留空壳", () => {
    const src = `叙事正文。
<div class="status-wrapper">
  <details class="status-card"><div>好感度 36%</div></details>
  <details class="status-card"><div>记忆</div></details>
</div>
<div class="after-status">保留内容</div>`;
    const out = stripStatusCards(src);
    expect(out).toBe(
      `叙事正文。

<div class="after-status">保留内容</div>`,
    );
  });

  test("无状态栏原样返回", () => {
    const src = "他推开门。";
    expect(stripStatusCards(src)).toBe(src);
  });

  test("空字符串", () => {
    expect(stripStatusCards("")).toBe("");
  });

  test("多余空行折叠", () => {
    const src = `A


<details class="status-card">x</details>


B`;
    const out = stripStatusCards(src);
    // 剥完不应有 3+ 连续空行
    expect(/\n{3,}/.test(out)).toBe(false);
    expect(out.includes("A")).toBe(true);
    expect(out.includes("B")).toBe(true);
  });
});

describe("geminiAntiStickPromptSection", () => {
  test("仅 gemini-3.1-pro-preview 返回禁令，其他模型返回空串", () => {
    expect(geminiAntiStickPromptSection("gemini-3.1-pro-preview")).not.toBe("");
    expect(geminiAntiStickPromptSection("claude-sonnet-4-6")).toBe("");
    expect(geminiAntiStickPromptSection("claude-opus-4-7")).toBe("");
    expect(geminiAntiStickPromptSection("gemini-2.5-pro")).toBe("");
    expect(geminiAntiStickPromptSection("deepseek-ai/DeepSeek-V3")).toBe("");
    expect(geminiAntiStickPromptSection("")).toBe("");
  });

  test("禁令内容含关键约束点", () => {
    const s = geminiAntiStickPromptSection("gemini-3.1-pro-preview");
    expect(s.includes("极其")).toBe(true);
    expect(s.includes("彻底")).toBe(true);
    expect(s.includes("发话")).toBe(true);
    expect(s.includes("最多出现 2 次")).toBe(true);
  });
});

describe("isPollutedByAdverbs 阈值", () => {
  test("绝对次数 ≥15 命中", () => {
    const src = "极其".repeat(15);
    expect(isPollutedByAdverbs(src)).toBe(true);
  });

  test("14 次不命中（且短文本免密度）", () => {
    const src = "极其".repeat(14);
    expect(isPollutedByAdverbs(src)).toBe(false);
  });

  test("长文本密度达标命中", () => {
    // 400 字符里出现 3 次（≥ 400/200 = 2）
    const src = `${"a".repeat(200)}极其${"b".repeat(100)}极其${"c".repeat(100)}极其`;
    expect(isPollutedByAdverbs(src)).toBe(true);
  });
});
