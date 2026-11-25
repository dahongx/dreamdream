import { describe, expect, test } from "bun:test";
import {
  ensureBlockSeparation,
  normalizeHtmlBlocks,
  prepareForMarkdown,
} from "@/lib/markdown-prep";

describe("ensureBlockSeparation", () => {
  test("inserts blank lines around <narration> so CommonMark sees a block, not inline", () => {
    const out = ensureBlockSeparation("foo<narration>x</narration>bar");
    expect(out).toContain("\n\n<narration>\n\n");
    expect(out).toContain("\n\n</narration>\n\n");
  });

  test("does not touch <strong> (real inline element)", () => {
    expect(ensureBlockSeparation("a <strong>b</strong> c")).toBe(
      "a <strong>b</strong> c",
    );
  });

  test("collapses 3+ consecutive newlines back to 2", () => {
    expect(ensureBlockSeparation("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("normalizeHtmlBlocks", () => {
  test("dedents creator-indented HTML inside a <div> block", () => {
    const src = [
      '<div class="x">',
      "    <span>a</span>",
      "          <span>b</span>",
      "</div>",
    ].join("\n");
    const out = normalizeHtmlBlocks(src);
    expect(out).toBe(
      ['<div class="x">', "<span>a</span>", "<span>b</span>", "</div>"].join(
        "\n",
      ),
    );
  });

  test("collapses blank lines inside an HTML block — this is the bug that exposed code", () => {
    // 还原贺韫/程彧 case: <div class="lin-shuo-ui"> 内部因 <!-- 注释 --> 前的
    // 空行被 markdown 当作 type-6 HTML block 终止符,空行后续上的高缩进 HTML
    // 被识别成 indented code block.normalizeHtmlBlocks 把这种空行吃掉,整段
    // 保持单一 HTML block.
    const src = [
      '<div class="lin-shuo-ui">',
      "<!-- panel 1 -->",
      '    <details class="a">',
      "        <summary>S1</summary>",
      "    </details>",
      "",
      "  <!-- panel 2 -->",
      '    <details class="b">',
      "        <summary>S2</summary>",
      "    </details>",
      "</div>",
    ].join("\n");
    const out = normalizeHtmlBlocks(src);
    expect(out).not.toMatch(/\n\n/); // no blank lines anywhere inside
    expect(out.split("\n").every((l) => !l.startsWith("    "))).toBe(true);
    expect(out).toContain('<details class="a">');
    expect(out).toContain('<details class="b">');
  });

  test("leaves <message> / <narration> blank-line separators outside HTML blocks alone", () => {
    // <message> 是 inline 语义标签,不算 block-level → depth 不涨 → 外部空行保留
    const src = "<message>hi</message>\n\n<narration>x</narration>";
    expect(normalizeHtmlBlocks(src)).toBe(src);
  });

  test("self-closing tags don't bump depth", () => {
    const src = ["<hr/>", "    <span>not in block</span>"].join("\n");
    // <hr/> is self-closing → depth stays 0 → second line untouched
    expect(normalizeHtmlBlocks(src)).toBe(src);
  });

  test("nested block tags track depth correctly; exit dedent after outermost close", () => {
    const src = [
      "<div>",
      "    <div>",
      "        a",
      "    </div>",
      "</div>",
      "    keep this leading indent",
    ].join("\n");
    const out = normalizeHtmlBlocks(src);
    const lines = out.split("\n");
    expect(lines[0]).toBe("<div>");
    expect(lines[1]).toBe("<div>");
    expect(lines[2]).toBe("a");
    expect(lines[3]).toBe("</div>");
    expect(lines[4]).toBe("</div>");
    // outside the block again — leading indent preserved
    expect(lines[5]).toBe("    keep this leading indent");
  });

  test("empty input is a no-op", () => {
    expect(normalizeHtmlBlocks("")).toBe("");
  });
});

describe("prepareForMarkdown — end-to-end on the actual bug input", () => {
  test("贺韫 lin-shuo-ui block renders as ONE HTML block after prep", () => {
    // 简化版还原: 顶部语义标签 + 底部状态面板
    const src = [
      "<message>明天还有演习。睡了。</message>",
      "",
      '<div class="lin-shuo-ui">',
      "<!-- 状态面板 -->",
      '    <details class="lin-details" open>',
      '        <summary class="lin-summary">🐺贺韫</summary>',
      '        <div class="lin-content">',
      "          OS: blah",
      "        </div>",
      "    </details>",
      "",
      "  <!-- 手机面板 -->",
      '    <details class="lin-details">',
      '        <summary class="lin-summary">🐺贺韫的iPhone</summary>',
      '        <div class="lin-content">',
      "          App push",
      "        </div>",
      "    </details>",
      "</div>",
    ].join("\n");
    const out = prepareForMarkdown(src);
    // <message> 应该仍被块级隔开
    expect(out).toContain("\n\n<message>");
    // lin-shuo-ui 内部: 没有 ≥2 连续换行, 没有 ≥4 空格行首
    const linshuoStart = out.indexOf('<div class="lin-shuo-ui">');
    const linshuoEnd = out.indexOf("</div>", linshuoStart);
    const inside = out.slice(linshuoStart, linshuoEnd);
    expect(inside).not.toMatch(/\n{2,}/);
    expect(inside.split("\n").every((l) => !l.startsWith("    "))).toBe(true);
    // 两个 details 都还在
    expect(out).toContain("🐺贺韫</summary>");
    expect(out).toContain("🐺贺韫的iPhone</summary>");
  });

  test("plain text passes through unchanged", () => {
    expect(prepareForMarkdown("just text\nno tags")).toBe("just text\nno tags");
  });
});
