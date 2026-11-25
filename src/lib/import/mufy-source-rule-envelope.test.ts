import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import type { RegexRule } from "@/lib/db/schema";
import { applyRegex } from "@/lib/regex/apply";
import { applyRegexToSegments } from "@/lib/regex/segments";
import {
  adaptMufySourceFrame,
  buildMufySourceRuleEnvelope,
  MUFY_SOURCE_ENVELOPE_PREFIX,
  splitMufySourceFrames,
  isMufySourceRuleEnvelope,
} from "./mufy-source-rule-envelope";

test('draft relay clears its delta synchronously and never repeats cached host text',async()=>{
 const dom=new JSDOM(adaptMufySourceFrame('<html><body><textarea id="ordinary">ordinary note</textarea></body></html>'),{url:'https://fixture.invalid',runScripts:'outside-only'}),doc=dom.window.document;
 const calls:string[]=[];let hostDraft='existing';
 Object.defineProperty(dom.window,'host',{value:{fillComposer:(text:string)=>{calls.push(text);hostDraft+=(hostDraft?'\n':'')+text;return Promise.resolve();}},configurable:true});
 // Execute only our platform relay, not captured author programs.
 dom.window.eval(doc.querySelector('script[data-mufy-draft-relay]')!.textContent!);
 const draft=doc.querySelector<HTMLTextAreaElement>('[data-mufy-draft-relay] textarea')!;
 const authorAppend=(text:string)=>{draft.value+=(draft.value?'\n':'')+text;draft.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 authorAppend('one');expect(draft.value).toBe('');expect(hostDraft).toBe('existing\none');
 hostDraft='';authorAppend('two');authorAppend('three');expect(calls).toEqual(['one','two','three']);expect(hostDraft).toBe('two\nthree');expect(draft.value).toBe('');
 draft.dispatchEvent(new dom.window.Event('input'));expect(calls.length).toBe(3);expect(doc.querySelector<HTMLTextAreaElement>('#ordinary')!.value).toBe('ordinary note');
 Object.defineProperty(dom.window,'host',{value:{fillComposer:()=>Promise.reject(Error('fixture rejection'))},configurable:true});authorAppend('retryable command');await new Promise(resolve=>dom.window.setTimeout(resolve,0));expect(draft.dataset.relayError).toBe('composer-fill-failed');expect(draft.value).toBe('');
 dom.window.close();
});

const capture = {
  version: 1,
  roleId: "role",
  capturedAt: "2026-10-15T00:00:00Z",
  captureScope: "normal-page-public-render-rules",
  responseCode: 200,
  responseDataWasNull: false,
  rules: [
    {
      regexRuleId: "prefix",
      ruleName: "start",
      regPattern: "<phone>",
      replaceString: "```html\n<section>",
    },
    {
      regexRuleId: "text",
      ruleName: "value",
      regPattern: "<text>(.*?)</text>",
      replaceString: "<p>$1</p>",
    },
    {
      regexRuleId: "suffix",
      ruleName: "end",
      regPattern: "</phone>",
      replaceString: "</section>\n```",
    },
  ],
};
function rule(replacement?: string): RegexRule {
  return {
    id: "source",
    packId: "pack",
    name: "source",
    targetText: null,
    pattern: "[\\s\\S]+",
    variableMapping: [],
    outputGuidance: null,
    replacement:
      replacement ?? buildMufySourceRuleEnvelope(capture, "role")!.replacement,
    enabled: true,
    visible: false,
    orderIndex: -90,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
describe("Mufy source rule chain routing", () => {
  test("native form CRLF serialization keeps the same source envelope and renderer",()=>{
    const original=buildMufySourceRuleEnvelope(capture,'role')!.replacement;
    const formValue=original.replace(/\r?\n/g,'\r\n');
    expect(isMufySourceRuleEnvelope(formValue)).toBe(true);
    const raw='<phone><text>ordinary reply</text></phone>';
    const a=applyRegexToSegments(raw,[rule(original)]);
    const b=applyRegexToSegments(raw,[rule(formValue)]);
    expect(b.segments).toEqual(a.segments);
    expect(b.matchedRules).toEqual(a.matchedRules);
  });
  test("self-contained mail keeps its authored dark ink instead of inheriting white global skin", () => {
    const html='```html\n<style>.mail{background:white;color:rgb(28,28,30)}.sender{color:black}</style><div class="mail"><div class="sender">Simon Lewis</div>Maintenance confirmed</div>\n```';
    const frames=splitMufySourceFrames(html,'*{color:white!important}.react-markdown{font-size:16px}');
    expect(frames).toHaveLength(1);
    if(frames[0].type!=='frame')throw Error('mail frame missing');
    const dom=new JSDOM(frames[0].srcdoc);
    expect(dom.window.getComputedStyle(dom.window.document.querySelector('.sender')!).color).toBe('rgb(0, 0, 0)');
    expect(dom.window.getComputedStyle(dom.window.document.querySelector('.mail')!).color).toBe('rgb(28, 28, 30)');
    expect(frames[0].srcdoc).not.toContain('color:white!important');
    dom.window.close();
  });
  test("message canvas is transparent without removing inner card backgrounds", () => {
    const skin = '<style>:root{--global-bg-color:#050505}body,html{background-color:var(--global-bg-color)!important}.mufy_message_system{background:rgb(1,31,32)}.mufy_message_system::before{content:"SYS.TASK_UPDATE //"}.card{background:rgb(34,45,56)}</style>';
    const result = applyRegexToSegments('<phone><text>正文</text></phone><system>小火新提示<script>bad()</script></system><div class="card">资料</div>', [rule(buildMufySourceRuleEnvelope(capture, "role", skin)!.replacement)]);
    const frame = result.segments[0];
    if (frame.type !== "iframe") throw new Error("source canvas missing");
    const dom = new JSDOM(frame.srcdoc);
    expect(dom.window.getComputedStyle(dom.window.document.body).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(dom.window.document.querySelectorAll('.mufy_message_system')).toHaveLength(1);
    expect(dom.window.document.querySelector('.mufy_message_system')?.textContent).toBe('小火新提示');
    expect(dom.window.getComputedStyle(dom.window.document.querySelector('.card')!).backgroundColor).toBe('rgb(34, 45, 56)');
    expect(frame.srcdoc).not.toContain('bad()');
    expect(frame.srcdoc).not.toContain('\\3c style');
    dom.window.close();
  });
  test("system adaptation requires a declared source skin and never rewrites fenced programs", () => {
    const raw = '<phone><text>值</text></phone><system>语义</system>';
    const noSkin = applyRegexToSegments(raw, [rule()]).segments[0];
    if (noSkin.type !== 'iframe') throw new Error('source canvas missing');
    expect(noSkin.srcdoc).not.toContain('class="mufy_message_system"');
    const fenced = '```html\n<script>const original="<system>literal</system>";</script>\n```';
    const out = applyRegexToSegments(raw+fenced, [rule(buildMufySourceRuleEnvelope(capture, 'role', '.mufy_message_system{color:teal}')!.replacement)]).segments[0];
    if (out.type !== 'iframe') throw new Error('source canvas missing');
    expect(out.srcdoc).toContain('class="mufy_message_system">语义');
    // Raw model scripts remain sanitized, not upgraded to source programs.
    expect(out.srcdoc).not.toContain('const original');
    const trustedCapture = {...capture,rules:capture.rules.map(r=>r.regexRuleId === 'suffix' ? {...r,replaceString:'</section><script>const saved="<system>source literal</system>";</script>\n```'} : r)};
    const trusted = applyRegexToSegments(raw, [rule(buildMufySourceRuleEnvelope(trustedCapture,'role','.mufy_message_system{color:teal}')!.replacement)]).segments[0];
    if (trusted.type !== 'iframe') throw new Error('source canvas missing');
    expect(trusted.srcdoc).toContain('const saved="<system>source literal</system>"');
  });
  test("public skin retains two-column status layout and bounded scrolling in the shared frame", () => {
    const skin = '.react-markdown section{display:grid;grid-template-columns:1fr 1fr}.react-markdown p{height:100px;overflow:auto}';
    const envelope = buildMufySourceRuleEnvelope(capture, "role", skin)!;
    const out = applyRegexToSegments("<phone><text>status</text></phone>", [rule(envelope.replacement)]);
    const frame = out.segments[0];
    if (frame.type !== "iframe") throw new Error("source canvas missing");
    const dom = new JSDOM(frame.srcdoc);
    const section = dom.window.document.querySelector("section")!;
    const text = dom.window.document.querySelector("section p")!;
    expect(dom.window.getComputedStyle(section).gridTemplateColumns).toBe("1fr 1fr");
    expect(dom.window.getComputedStyle(text).height).toBe("100px");
    expect(dom.window.getComputedStyle(text).overflow).toBe("auto");
    dom.window.close();
  });
  test("applies the full chain before splitting completed fences", () => {
    const result = applyRegexToSegments(
      "before <phone><text>new $1 mufyer</text></phone> after",
      [rule()],
    );
    expect(result.matchedRules[0].count).toBe(3);
    expect(result.segments).toHaveLength(1);
    const frame = result.segments[0];
    expect(frame.type).toBe("iframe");
    if (frame.type === "iframe") {
      expect(frame.srcdoc).toContain("<section><p>new $1 mufyer</p></section>");
      expect(frame.srcdoc).toContain("before ");
      expect(frame.srcdoc).toContain(" after");
      expect(frame.srcdoc).toContain("window.host.context.userName");
      expect(frame.srcdoc).toContain("NodeFilter.SHOW_TEXT");
      expect(frame.srcdoc).not.toContain("allow-same-origin");
      expect(frame.captureGroups).toEqual([]);
      expect(frame.minHeight).toBe(1);
    }
  });
  test("general and stream path returns rendered chain, not metadata", () => {
    const result = applyRegex("<phone><text>changed</text></phone>", [rule()]);
    expect(result.text).toBe("```html\n<section><p>changed</p></section>\n```");
    expect(result.text).not.toContain(MUFY_SOURCE_ENVELOPE_PREFIX);
  });
  test("invalid data preserves raw and records explicit failure", () => {
    const result = applyRegexToSegments("original", [
      rule(MUFY_SOURCE_ENVELOPE_PREFIX + "{"),
    ]);
    expect(result.segments).toEqual([{ type: "html", content: "original" }]);
    expect(result.matchedRules).toHaveLength(0);
    expect(result.unmatchedRules[0].reason).toContain(
      "source rule chain rejected",
    );
  });
  test("no match does not convert arbitrary model-generated fences", () => {
    const raw = "```html\n<script>arbitrary()</script>\n```";
    expect(applyRegexToSegments(raw, [rule()]).segments).toEqual([
      { type: "html", content: raw },
    ]);
  });
  test("existing earlier exact-opening iframes are not transformed again", () => {
    const exact = {
      ...rule(),
      id: "exact",
      orderIndex: -100,
      pattern: "OPEN",
      replacement: "<artifact><p>exact</p></artifact>",
    };
    const result = applyRegexToSegments("OPEN", [rule(), exact]);
    expect(result.segments).toEqual([
      {
        type: "iframe",
        ruleId: "exact",
        ruleName: "source",
        srcdoc: "<p>exact</p>",
        captureGroups: [],
      },
    ]);
  });
  test("empty capture is valid evidence but creates no catch-all rule", () => {
    expect(
      buildMufySourceRuleEnvelope({ ...capture, rules: [] }, "role"),
    ).toBeUndefined();
  });
  test("source phone textarea relay only fills draft, never sends", async () => {
    const filled: string[] = [];
    const source = `<textarea id="author-form">keep</textarea><script>var d=window.parent.document;var t=d.querySelector('#mufy_chat_input_box textarea')||d.querySelector('textarea');Object.getOwnPropertyDescriptor(window.parent.HTMLTextAreaElement.prototype,'value').set.call(t,'new draft');t.dispatchEvent(new Event('input',{bubbles:true}));</script>`;
    // Bun's VM cannot run JSDOM's proxied global. Execute only this test-owned
    // fixture and our adaptation in explicit DOM globals, never captured code.
    const VisualJSDOM = JSDOM as unknown as {
      new (
        html: string,
        options: { pretendToBeVisual: boolean },
      ): InstanceType<typeof JSDOM>;
    };
    const dom = new VisualJSDOM(adaptMufySourceFrame(source), {
      pretendToBeVisual: true,
    });
    Object.assign(dom.window, {
      host: {
        context: { userName: "本平台用户" },
        fillComposer: async (value: string) => {
          filled.push(value);
        },
      },
    });
    for (const script of dom.window.document.querySelectorAll("script")) {
      new Function(
        "window",
        "document",
        "Event",
        "NodeFilter",
        "MutationObserver",
        "requestAnimationFrame",
        "parent",
        script.textContent ?? "",
      )(
        dom.window,
        dom.window.document,
        dom.window.Event,
        dom.window.NodeFilter,
        dom.window.MutationObserver,
        dom.window.requestAnimationFrame.bind(dom.window),
        { postMessage() {} },
      );
    }
    await Promise.resolve();
    expect(filled).toEqual(["new draft"]);
    expect(
      (dom.window.document.querySelector("#author-form") as HTMLTextAreaElement)
        .value,
    ).toBe("keep");
    expect(
      dom.window.document.querySelector("[data-mufy-draft-relay]"),
    ).not.toBeNull();
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
    const trigger = dom.window.document.createElement("button");
    trigger.className = "cen-dg-trigger-local";
    dom.window.document.body.append(trigger);
    const modal = dom.window.document.createElement("div");
    modal.id = "CEN_DG_MODAL";
    modal.textContent = "dynamic mufyer {{user}}";
    modal.setAttribute("data-author-value", "mufyer");
    dom.window.document.body.prepend(modal);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(modal.previousElementSibling).toBe(trigger);
    expect(modal.textContent).toBe("dynamic 本平台用户 本平台用户");
    expect(modal.getAttribute("data-author-value")).toBe("mufyer");
    expect(filled).toEqual(["new draft"]);
    dom.window.close();
  });
  test("known generator namespace is local but arbitrary parent APIs stay untouched", () => {
    const srcdoc = adaptMufySourceFrame(
      `<script>window.parent.Tuan_init_OpenModal();window.parent.arbitrary();tempTx.select();doc.execCommand('copy');</script>`,
    );
    expect(srcdoc).toContain("window.Tuan_init_OpenModal()");
    expect(srcdoc).toContain("window.parent.arbitrary()");
    expect(srcdoc).toContain("window.host.fillComposer(tempTx.value)");
    expect(srcdoc).not.toContain("execCommand('copy')");
  });
  test("meta styles, native status details, and directive share a single source canvas", () => {
    const sourceCapture = {
      ...capture,
      rules: [
        {
          regexRuleId: "meta",
          ruleName: "meta",
          regPattern: "<meta>",
          replaceString:
            "```html\n<script>var s=window.parent.document.createElement('style');s.textContent='.z-grid2{display:grid;grid-template-columns:1fr 1fr}.z-scroll{height:100px;overflow:auto}';window.parent.document.head.append(s);</script>\n```",
        },
        {
          regexRuleId: "status",
          ruleName: "status",
          regPattern: "<status>(.*?)</status>",
          replaceString:
            '<details class="z-status"><summary>状态</summary><div class="z-grid2"><div class="z-scroll">$1</div><div>mufyer</div></div></details>',
        },
        {
          regexRuleId: "directive",
          ruleName: "directive",
          regPattern: "<directive>",
          replaceString:
            '```html\n<button id="source-directive" onclick="window.host.fillComposer(\'draft\')">定制</button>\n```',
        },
      ],
    };
    const envelope = rule(
      buildMufySourceRuleEnvelope(sourceCapture, "role")!.replacement,
    );
    const out = applyRegexToSegments(
      "<meta>\n第一行\n第二行<status>new status</status><directive>",
      [envelope],
    );
    expect(out.segments).toHaveLength(1);
    const frame = out.segments[0];
    if (frame.type !== "iframe") throw new Error("source canvas missing");
    const doc = new JSDOM(frame.srcdoc);
    expect(
      doc.window.document.querySelectorAll("details.z-status"),
    ).toHaveLength(1);
    expect(
      doc.window.document.querySelector("details .z-grid2 .z-scroll")!
        .textContent,
    ).toBe("new status");
    expect(
      doc.window.document
        .querySelector("#source-directive")!
        .getAttribute("onclick"),
    ).toContain("fillComposer");
    expect(frame.srcdoc).toContain("document.head.append(s)");
    const metaScript = Array.from(
      doc.window.document.querySelectorAll("script"),
    ).find((script) =>
      script.textContent?.startsWith("var s=document.createElement"),
    );
    if (!metaScript) throw new Error("synthetic meta script missing");
    new Function("document", metaScript.textContent!)(doc.window.document);
    const grid = doc.window.document.querySelector(".z-grid2")!;
    const scroll = doc.window.document.querySelector(".z-scroll")!;
    expect(doc.window.getComputedStyle(grid).gridTemplateColumns).toBe(
      "1fr 1fr",
    );
    expect(doc.window.getComputedStyle(scroll).height).toBe("100px");
    expect(doc.window.getComputedStyle(scroll).overflow).toBe("auto");
    expect(frame.srcdoc).toContain("第一行\n第二行");
    expect(frame.srcdoc).toContain(
      'class="mufy-source-canvas react-markdown" style="white-space:pre-wrap"',
    );
    doc.window.close();
  });
  test("TimeBox and system HTML stay together while native model scripts cannot gain source privileges", () => {
    const sourceCapture = {
      ...capture,
      rules: [
        {
          regexRuleId: "time",
          ruleName: "TimeBox",
          regPattern: "<TimeBox>(.*?)</TimeBox>",
          replaceString:
            '```html\n<div id="time">$1</div><script>window.sourceOnly=true;</script>\n```',
        },
        {
          regexRuleId: "system",
          ruleName: "system",
          regPattern: "<system>(.*?)</system>",
          replaceString: '<aside class="system-box">$1</aside>',
        },
      ],
    };
    const raw =
      '<TimeBox>17:45</TimeBox><system>new message</system><script>nativeRaw()</script><img src="x" onerror="nativeEvent()">\n```html\n<script>nativeFence()</script><p>model fence text</p>\n```';
    const out = applyRegexToSegments(raw, [
      rule(buildMufySourceRuleEnvelope(sourceCapture, "role")!.replacement),
    ]);
    expect(out.segments).toHaveLength(1);
    const frame = out.segments[0];
    if (frame.type !== "iframe") throw new Error("source canvas missing");
    expect(frame.srcdoc).toContain('id="time">17:45');
    expect(frame.srcdoc).toContain('class="system-box">new message');
    expect(frame.srcdoc).toContain("window.sourceOnly=true");
    expect(frame.srcdoc).toContain("model fence text");
    expect(frame.srcdoc).not.toContain("nativeRaw()");
    expect(frame.srcdoc).not.toContain("nativeFence()");
    expect(frame.srcdoc).not.toContain("nativeEvent()");
  });
  test("source chains without executable HTML fences keep ordinary HTML routing", () => {
    const sourceCapture = {
      ...capture,
      rules: [
        {
          regexRuleId: "plain",
          ruleName: "plain",
          regPattern: "<x>(.*?)</x>",
          replaceString: "<b>$1</b>",
        },
      ],
    };
    const out = applyRegexToSegments("<x>value</x>", [
      rule(buildMufySourceRuleEnvelope(sourceCapture, "role")!.replacement),
    ]);
    expect(out.segments).toEqual([{ type: "html", content: "<b>value</b>" }]);
  });
});
