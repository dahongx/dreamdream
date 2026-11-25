import { describe, expect, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";

// Repository has jsdom runtime but no @types/jsdom. Only standard DOM APIs are used here.
const { JSDOM } = require("jsdom") as {
  JSDOM: new (source: string) => { window: { document: Document } };
};

import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { prepareForMarkdown } from "@/lib/markdown-prep";
import {
  protectMufyPublicParagraphLf,
  rehypeRestoreMufyPublicParagraphLf,
} from "@/lib/mufy-public-paragraph-lf";
import * as sanitizeModule from "@/lib/sanitize";
import { sanitizeHtml } from "@/lib/sanitize";

function render(source: string, mode: boolean) {
  const envelope = protectMufyPublicParagraphLf(source, mode);
  const safe = sanitizeHtml(prepareForMarkdown(envelope.source));
  const html = renderToStaticMarkup(
    <Markdown
      remarkPlugins={[remarkBreaks]}
      rehypePlugins={[
        rehypeRaw,
        rehypeRestoreMufyPublicParagraphLf(envelope.token),
      ]}
    >
      {safe}
    </Markdown>,
  );
  return { html, doc: new JSDOM(html).window.document, envelope };
}
describe("Mufy-only public paragraph LF preservation, actual sanitize/Markdown/React pipeline", () => {
  test("no eligible text LF is exact no-op with zero collision sanitization calls", () => {
    const spy = spyOn(sanitizeModule, "sanitizeHtml");
    try {
      for (const source of [
        "plain\n\ntext",
        '<p class="ordinary">a\n\nb</p>',
        '<p class="leading-5 text-white">one line</p>\n<div>other</div>',
        '<p class="leading-5 text-white" title="a\nb">no text LF</p>',
        '<p class="leading-5 text-white"><code>a\nb</code></p>',
      ]) {
        expect(protectMufyPublicParagraphLf(source, true)).toEqual({
          source,
          token: null,
          protectedCount: 0,
        });
      }
      expect(spy).toHaveBeenCalledTimes(0);
    } finally {
      spy.mockRestore();
    }
  });
  test("captured paragraph shape preserves exact first paragraph double LF and copies no markers", () => {
    const source =
      '<p class="leading-5 text-white">▶2025-10-20 21:20\n▷测试场景\n\n第一段正文。</p>\n<p class="leading-5 text-white">第二段。</p>';
    const expected = new JSDOM(source).window.document.querySelector(
      "p",
    )?.textContent;
    const legacy = render(source, false),
      fixed = render(source, true);
    expect(legacy.doc.querySelector("p")?.textContent).not.toBe(expected);
    expect(fixed.doc.querySelector("p")?.textContent).toBe(expected);
    expect(fixed.doc.querySelector("p")?.textContent).toContain(
      "▷测试场景\n\n第一段",
    );
    expect(fixed.doc.querySelectorAll("pre code")).toHaveLength(0);
    expect(fixed.html).not.toContain("MUFY_PUBLIC_LF_");
    expect(fixed.doc.querySelectorAll("p").length).toBe(
      new JSDOM(source).window.document.querySelectorAll("p").length,
    );
  });
  test("native Dearm mode is byte-for-byte no-op including indented code and blank lines", () => {
    const source =
      '<p class="leading-5 text-white">a\n\nb</p>\n\n    native code';
    const e = protectMufyPublicParagraphLf(source);
    expect(e.source).toBe(source);
    expect(e.token).toBeNull();
    const legacy = renderToStaticMarkup(
      <Markdown remarkPlugins={[remarkBreaks]} rehypePlugins={[rehypeRaw]}>
        {sanitizeHtml(prepareForMarkdown(source))}
      </Markdown>,
    );
    expect(render(source, false).html).toBe(legacy);
  });
  test("贺韫/程彧 indented HTML details remain real elements, never visible code", () => {
    const source =
      '<message>明天演习</message>\n\n<div class="lin-shuo-ui">\n    <details><summary>状态</summary>\n        <div>正常正文</div>\n    </details>\n\n  <!-- 手机 -->\n    <details><summary>手机</summary>\n        <div>推送</div>\n    </details>\n</div>';
    for (const mode of [false, true]) {
      const out = render(source, mode);
      expect(out.doc.querySelectorAll("details")).toHaveLength(2);
      expect(out.doc.querySelectorAll("pre code")).toHaveLength(0);
      expect(out.doc.body.textContent).not.toContain("<details>");
    }
  });
  test("only explicit Mufy paragraphs protected; attributes/comments/code unchanged", () => {
    const source =
      '<p class="ordinary">a\n\nb</p><p class="leading-5 text-white" title="x\ny">a<span>b\n\nc</span><code>x\ny</code></p>';
    const e = protectMufyPublicParagraphLf(source, true);
    expect(e.source).toContain('ordinary">a\n\nb');
    expect(e.source).toContain('title="x\ny"');
    expect(e.source).toContain("<code>x\ny</code>");
    const out = render(source, true);
    expect(out.doc.querySelectorAll("p")[1].textContent).toContain(
      "ab\n\ncx\ny",
    );
    expect(out.html).not.toContain("MUFY_PUBLIC_LF_");
  });
  test("literal and character-reference token collisions preserve authored text", () => {
    for (const authored of [
      "\uE000MUFY_PUBLIC_LF_0\uE001",
      "&#57344;MUFY_PUBLIC_LF_0&#57345;",
    ]) {
      const out = render(
        `<p class="leading-5 text-white">${authored}\n\nb</p>`,
        true,
      );
      expect(out.envelope.token).toBe("\uE000MUFY_PUBLIC_LF_1\uE001");
      expect(out.doc.querySelector("p")?.textContent).toBe(
        "\uE000MUFY_PUBLIC_LF_0\uE001\n\nb",
      );
    }
  });
  test("script and unsafe elements remain removed by real sanitizer", () => {
    const out = render(
      '<p class="leading-5 text-white" onclick="alert(1)">a\n\nb<script>alert(1)</script><img src="x" onerror="alert(1)"></p>',
      true,
    );
    expect(out.doc.querySelector("script")).toBeNull();
    expect(out.html).not.toContain("onclick");
    expect(out.html).not.toContain("onerror");
    expect(out.doc.querySelector("p")?.textContent).toBe("a\n\nb");
  });
  test("raw code/pre/style/script/textarea text is never tokenized, including tag-like raw contents", () => {
    for (const tag of ["code", "pre", "style", "script", "textarea"]) {
      const source = `<p class="leading-5 text-white"><${tag}>a\n\nb <p class="leading-5 text-white">c\n\nd</p></${tag}>z\n\nw</p>`;
      const e = protectMufyPublicParagraphLf(source, true);
      expect(e.protectedCount).toBe(2);
      expect(e.source).toContain(
        `a\n\nb <p class="leading-5 text-white">c\n\nd</p>`,
      );
      expect(render(source, true).html).not.toContain("MUFY_PUBLIC_LF_");
    }
  });
  test("unclosed streaming paragraph preserves LF and every partial tag boundary leaves no marker", () => {
    const source =
      '<p class="leading-5 text-white">a\n\nb<span title="x\ny">c\n\nd</span>e\n\nf</p>';
    for (let end = 0; end <= source.length; end++)
      expect(render(source.slice(0, end), true).html).not.toContain(
        "MUFY_PUBLIC_LF_",
      );
    expect(
      render('<p class="leading-5 text-white">a\n\nb', true).doc.querySelector(
        "p",
      )?.textContent,
    ).toBe("a\n\nb");
  });
  test("production MessageRenderer preserves public opening paragraph LF end to end", () => {
    const source =
      '<p class="leading-5 text-white">▶2025-10-20 21:20\n▷测试场景\n\n第一段正文。</p>\n<p class="leading-5 text-white">第二段。</p>';
    const expected = new JSDOM(source).window.document.querySelector(
      "p",
    )?.textContent;
    const html = renderToStaticMarkup(
      <MessageRenderer source={source} mufySourceDefaults />,
    );
    expect(
      new JSDOM(html).window.document.querySelector("p.leading-5.text-white")
        ?.textContent,
    ).toBe(expected);
    expect(html).not.toContain("MUFY_PUBLIC_LF_");
  });
});
