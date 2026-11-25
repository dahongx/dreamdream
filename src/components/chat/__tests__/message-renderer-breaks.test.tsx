import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageRenderer } from "@/components/chat/MessageRenderer";

/**
 * 回归：段落内单换行必须渲染成 <br>（remark-breaks），对齐软换行行为。
 *
 * 背景：创作者的纯文本状态栏（━━ / Time: / Loc: / Char: / ━━）靠单换行分行。
 * CommonMark 默认把段内单个 \n 折叠成空格 → 状态栏被挤成一行（贺韫等 18 张卡）。
 * MessageRenderer 挂 remark-breaks 后每个单换行变 <br>，折行恢复。
 */
function html(src: string): string {
  return renderToStaticMarkup(<MessageRenderer source={src} />);
}

describe("MessageRenderer — 单换行断行 (remark-breaks)", () => {
  test("裸文本状态栏的每个单换行渲染成 <br>", () => {
    const statusBar = [
      "━━━━━━━━━━",
      "Time: [4025/01/01], [星期三][21:15]",
      "Loc: [铁王座星 · 东宫私人区域]",
      "Char: [贺韫、猫(test)]",
      "━━━━━━━━━━",
      "贺韫感觉到怀里的重量动了一下。",
    ].join("\n");
    const out = html(statusBar);
    // 5 个行间换行 → 5 个 <br>
    expect((out.match(/<br/g) ?? []).length).toBe(5);
    expect(out).toContain("Time: [4025/01/01]");
    expect(out).toContain("Char: [贺韫、猫(test)]");
  });

  test("空行分段仍是独立 <p>，不额外插 <br>", () => {
    const out = html("第一段。\n\n第二段。");
    expect((out.match(/<p>/g) ?? []).length).toBe(2);
    expect(out).not.toContain("<br");
  });

  test("HTML block（div）内部换行不被 remark-breaks 触碰", () => {
    const src = [
      '<div class="xiaoran-ui">',
      "<div>Time: 2024</div>",
      "</div>",
    ].join("\n");
    const out = html(src);
    expect(out).not.toContain("<br");
    expect(out).toContain('class="xiaoran-ui"');
  });

  test("code fence 内换行保持原样，不变 <br>", () => {
    const out = html("台词\n\n```html\n<div>island</div>\n```\n后续");
    // <br> 不应出现在 <pre> 里
    expect(out).not.toMatch(/<pre>[\s\S]*<br[\s\S]*<\/pre>/);
  });
});
