import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { deriveMufyPublicIntroductionSequence } from "../mufy-public-introduction-sequence";
import { routeOpeningContentSplit } from "../../opening/content";

function frame(html: string): string {
  const document = new JSDOM("").window.document;
  const element = document.createElement("iframe");
  element.setAttribute("srcdoc", html);
  const encoded = element.outerHTML;
  document.defaultView?.close();
  return encoded;
}
const body = (html: string) => new JSDOM(html).window.document.body.textContent?.trim();

test("ordinary before, between and after nodes keep their order around two decoded frame documents", () => {
  const r = deriveMufyPublicIntroductionSequence({ componentMarkup: `<p>before</p>${frame("<p>frame1</p>")}<p>between</p>${frame("<p>frame2</p>")}<p>after</p>` });
  expect(r.segments.map(s => s.kind)).toEqual(["html-fragment", "frame-document", "html-fragment", "frame-document", "html-fragment"]);
  expect(r.documents.map(body)).toEqual(["before", "frame1", "between", "frame2", "after"]);
  expect(r.documents.every(d => !new JSDOM(d).window.document.querySelector("iframe"))).toBe(true);
  expect(r.ledger.missing).toEqual([]);
  expect(r.ledger.browserAcceptance).toBe("not-assessed");
  expect(r.readyForPreparation).toBe(true);
}, 30_000);

test("nested wrappers are preserved across partial Range boundaries", () => {
  const r = deriveMufyPublicIntroductionSequence({ componentMarkup: `<div class="outer"><section data-area="intro"><b>A</b>${frame("<p>one</p>")}<i>B</i>${frame("<p>two</p>")}<b>C</b></section></div>` });
  const fragments = r.segments.filter(s => s.kind === "html-fragment");
  expect(fragments).toHaveLength(3);
  for (const fragment of fragments) {
    const doc = new JSDOM(fragment.fragmentHtml!).window.document;
    expect(doc.querySelector(".outer > section[data-area=intro]")).not.toBeNull();
  }
  expect(fragments.map(f => body(f.fragmentHtml!))).toEqual(["A", "B", "C"]);
}, 30_000);

test("pure iframes yield only their documents without invented empty placeholders", () => {
  const r = deriveMufyPublicIntroductionSequence({ componentMarkup: ` \n${frame("<p>甲</p>")} \n${frame("<p>乙</p>")} ` });
  expect(r.segments.map(s => s.kind)).toEqual(["frame-document", "frame-document"]);
  expect(r.documents.map(body)).toEqual(["甲", "乙"]);
  expect(r.ledger.ranges.every(r => r.disposition === "empty-wrapper-only")).toBe(true);
}, 30_000);

test("ordinary HTML with no iframe is retained with source styles inside its isolated document", () => {
  const r = deriveMufyPublicIntroductionSequence({ componentMarkup: '<article><h2>iMessage</h2><a href="https://example.test/guide.pdf">PDF</a><img src="image.png"><button>打开</button><input></article>', styles: ["article{color:purple}"] });
  expect(r.segments).toHaveLength(1);
  expect(r.segments[0].kind).toBe("html-fragment");
  const doc = new JSDOM(r.documents[0]).window.document;
  expect(doc.querySelector("head style")?.textContent).toBe("article{color:purple}");
  expect(doc.querySelector("body article a")?.getAttribute("href")).toBe("https://example.test/guide.pdf");
  expect(doc.querySelectorAll("img,button,input")).toHaveLength(3);
}, 30_000);

test("script-only and style-only ranges are not discarded or executed", () => {
  const r = deriveMufyPublicIntroductionSequence({ componentMarkup: `<script>window.authorWasExecuted=true;</script>${frame("<p>middle</p>")}<style id="author-style">.x{color:red}</style>` });
  expect(r.segments.map(s => s.kind)).toEqual(["html-fragment", "frame-document", "html-fragment"]);
  expect(r.documents[0]).toContain("window.authorWasExecuted=true");
  expect(r.documents[2]).toContain('id="author-style"');
  expect((globalThis as Record<string, unknown>).authorWasExecuted).toBeUndefined();
}, 30_000);

test("srcdoc entities decode exactly once and retain complete Chinese plus UTF16 emoji", () => {
  const original = '<!doctype html><html><body><p title="引号 &amp;">中文🙂 &amp; 完整</p></body></html>';
  const r = deriveMufyPublicIntroductionSequence({ componentMarkup: frame(original) });
  expect(r.segments[0].sourceDocument).toBe(original);
  expect(body(r.documents[0])).toBe("中文🙂 & 完整");
  expect(new JSDOM(r.documents[0]).window.document.querySelector("p")?.getAttribute("title")).toBe("引号 &");
}, 30_000);

test("remote or blank frames remain explicit unresolved entries, never omitted or faked as loaded", () => {
  const r = deriveMufyPublicIntroductionSequence({ componentMarkup: '<p>A</p><iframe src="https://example.test/public-player"></iframe><p>B</p><iframe srcdoc=""></iframe>' });
  expect(r.segments.map(s => s.kind)).toEqual(["html-fragment", "unresolved-frame", "html-fragment", "unresolved-frame"]);
  expect(r.unresolved.map(x => x.reason)).toEqual(["REMOTE_FRAME_WITHOUT_READABLE_SRCDOC", "EMPTY_OR_MISSING_SRCDOC"]);
  expect(r.readyForPreparation).toBe(false);
  expect(r.codeRenderContent).toBe("");
  expect(r.segments[1].sourceFrameMarkup).toContain("https://example.test/public-player");
  expect(r.documents.map(body)).toEqual(["A", "B"]);
  expect(r.ledger.frames).toHaveLength(2);
  expect(r.ledger.missing).toEqual([]);
  expect(r.ledger.browserAcceptance).toBe("not-assessed");
}, 30_000);

test("iframe under native details retains source evidence but blocks independent import", () => {
  const sourceDocument = "<p>完整音乐控件🙂</p>";
  const sourceFrame = frame(sourceDocument);
  const r = deriveMufyPublicIntroductionSequence({ componentMarkup: `<details><summary>古风乐府</summary><section>${sourceFrame}</section></details>`, parentTextStyle: {fontSize:"14px",lineHeight:"20px"} });
  expect(r.readyForPreparation).toBe(false);
  expect(r.codeRenderContent).toBe("");
  expect(r.unresolved).toHaveLength(1);
  expect(r.unresolved[0].reason).toBe("FRAME_INSIDE_DETAILS_REQUIRES_BOUND_CONTROL");
  expect(r.unresolved[0].sourceAncestorSummary).toBe("古风乐府");
  const unresolved = r.segments.find(s => s.kind === "unresolved-frame");
  expect(unresolved?.sourceDocument).toBe(sourceDocument);
  expect(unresolved?.sourceFrameMarkup).toBe(sourceFrame);
  expect(r.ledger.frames[0].disposition).toBe("unresolved");
  expect(r.ledger.missing).toEqual([]);
  expect(r.ledger.browserAcceptance).toBe("not-assessed");
}, 30_000);

test("only an explicitly captured parent text baseline is inherited by ordinary fragment text", () => {
  const componentMarkup = "<details><summary>普通摘要</summary><p>正文</p></details>";
  const absent = deriveMufyPublicIntroductionSequence({ componentMarkup });
  expect(absent.documents[0]).not.toContain("data-mufy-captured-parent-text");
  expect(absent.ledger.parentTextStyle.captured).toBe(false);
  expect(absent.ledger.parentTextStyle.adoptedValues).toBeNull();
  const parentTextStyle = {fontSize:"14px",lineHeight:"20px",fontFamily:'"Times New Roman", serif',color:"rgb(17, 34, 51)"};
  const captured = deriveMufyPublicIntroductionSequence({ componentMarkup, parentTextStyle });
  const dom = new JSDOM(captured.documents[0]);
  const summary = dom.window.getComputedStyle(dom.window.document.querySelector("summary")!);
  expect(summary.fontSize).toBe("14px");
  expect(summary.lineHeight).toBe("20px");
  expect(summary.fontFamily).toBe('"Times New Roman", serif');
  expect(summary.color).toBe("rgb(17, 34, 51)");
  expect(dom.window.document.head.firstElementChild?.getAttribute("data-mufy-captured-parent-text")).toBe("true");
  expect(dom.window.document.head.firstElementChild?.textContent).not.toContain("!important");
  expect(captured.ledger.parentTextStyle.adoptedValues).toEqual(parentTextStyle);
  expect(captured.ledger.parentTextStyle.appliedFragmentCount).toBe(1);
  dom.window.close();
}, 30_000);

test("captured parent text never changes any original iframe document bytes", () => {
  const original = '<style>body{font-size:22px;line-height:31px;font-family:Georgia;color:navy}</style><p>独立原文档</p>';
  const componentMarkup = `<p>前</p>${frame(original)}<p>后</p>`;
  const plain = deriveMufyPublicIntroductionSequence({ componentMarkup });
  const styled = deriveMufyPublicIntroductionSequence({ componentMarkup, parentTextStyle: {fontSize:"14px",lineHeight:"20px",fontFamily:"Times",color:"red"} });
  const before = plain.segments.find(s=>s.kind==="frame-document")!;
  const after = styled.segments.find(s=>s.kind==="frame-document")!;
  expect(after.sourceDocument).toBe(original);
  expect(after.documentHtml).toBe(before.documentHtml);
  expect(after.documentHtml).not.toContain("data-mufy-captured-parent-text");
  expect(styled.ledger.parentTextStyle.appliedFragmentCount).toBe(2);
  const dom = new JSDOM(after.documentHtml!);
  expect(dom.window.getComputedStyle(dom.window.document.body).fontSize).toBe("22px");
  expect(dom.window.getComputedStyle(dom.window.document.body).lineHeight).toBe("31px");
  dom.window.close();
}, 30_000);

test("later explicit author text styles override the zero-specificity measured baseline", () => {
  const result = deriveMufyPublicIntroductionSequence({
    componentMarkup: "<style>summary{font-size:19px;line-height:29px;color:rgb(9,8,7)}</style><details><summary>作者显式样式</summary></details>",
    styles: ["body{font-size:18px;line-height:28px;font-family:Georgia}"],
    parentTextStyle: {fontSize:"14px",lineHeight:"20px",fontFamily:"Times",color:"rgb(1,2,3)"},
  });
  const dom = new JSDOM(result.documents[0]);
  const body = dom.window.getComputedStyle(dom.window.document.body);
  const summary = dom.window.getComputedStyle(dom.window.document.querySelector("summary")!);
  expect(body.fontSize).toBe("18px");
  expect(body.lineHeight).toBe("28px");
  expect(summary.fontSize).toBe("19px");
  expect(summary.lineHeight).toBe("29px");
  expect(summary.fontFamily).toBe("Georgia");
  expect(summary.color).toBe("rgb(9, 8, 7)");
  dom.window.close();
}, 30_000);

test("parent computed-text input rejects declaration injection, wrong types and permission fields", () => {
  const values = [
    {fontSize:"14px;position:fixed",lineHeight:"20px"},
    {fontSize:"14px",lineHeight:"20px!important"},
    {fontSize:"14px",lineHeight:"20px",fontFamily:'Times</style><script>bad()</script>'},
    {fontSize:"14px",lineHeight:"20px",color:"url(https://example.test/x)"},
    {fontSize:14,lineHeight:"20px"},
    {fontSize:"14px",lineHeight:"20px",allowScripts:true},
    {fontSize:"14px",lineHeight:"20px",cssText:"color:red"},
  ];
  for (const value of values) expect(()=>deriveMufyPublicIntroductionSequence({componentMarkup:"<p>safe</p>",parentTextStyle:value as never})).toThrow("MUFY_INTRODUCTION_INVALID_PARENT_TEXT_STYLE:");
}, 30_000);

test("only truly empty anonymous wrappers can be dropped; named empty anchors remain", () => {
  const empty = deriveMufyPublicIntroductionSequence({ componentMarkup: "<div><span> </span></div>" });
  expect(empty.documents).toEqual([]);
  const named = deriveMufyPublicIntroductionSequence({ componentMarkup: '<div id="author-mount"></div>' });
  expect(named.documents).toHaveLength(1);
  expect(named.documents[0]).toContain('id="author-mount"');
}, 30_000);

test("renderer keeps ordinary iMessage/PDF inline and only the actual orb floating", () => {
  const r = deriveMufyPublicIntroductionSequence({
    componentMarkup: `<div class="censy-imsg">iMessage</div>${frame('<div id="censy-floatOrb-root">real orb</div>')}<article class="censy-dossier">PDF</article>`,
    styles: [".censy-imsg{color:rgb(12,34,56)}.censy-dossier{background:#f2f2f7}.censy-floatOrb-root{position:fixed;color:pink}#censy-floatOrb-root{position:fixed}"],
  });
  const route = routeOpeningContentSplit(r.codeRenderContent, "sequence-test");
  expect(route.floating).toHaveLength(1);
  expect(route.floating[0].meta.kind).toBe("orb-right");
  const inline = route.inline?.kind === "iframe-multi" ? route.inline.srcdocs.join("\n") : route.inline?.kind === "iframe" ? route.inline.srcdoc : "";
  expect(inline).toContain("iMessage");
  expect(inline).toContain("PDF");
  expect(inline).toContain("rgb(12,34,56)");
  expect(inline).toContain("#f2f2f7");
  expect(inline).not.toContain("censy-floatOrb-root");
}, 30_000);
