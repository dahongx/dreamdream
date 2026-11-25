import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MufyPublicWarningCandidate } from "@/components/chat/MufyPublicWarningCandidate";
import { routeOpeningContentSplit } from "../../opening/content";
import { prepareMufyMigration } from "../mufy-migration";
import {
  buildPublicHostWarningFloating,
  derivePublicHostWarningContract,
  PUBLIC_WARNING_CLASSES,
  parsePublicHostWarningContract,
} from "../mufy-public-host-warning-candidate";

const observed = JSON.parse(
  readFileSync(
    "outputs/mufy-rank53-70-20261111/rank69/source-note-warning-observed-root.json",
    "utf8",
  ),
);
const capture = JSON.parse(
  readFileSync(
    "outputs/mufy-rank53-70-20261111/rank69/public-capture.json",
    "utf8",
  ),
) as { styles: string[] };
const css = capture.styles.map((s) => `<style>${s}</style>`).join("\n");
const observation = { ...observed.warning[0], observedAt: observed.observedAt };
const text = "护你周全，免你惊苦，许你长欢";
const contract = derivePublicHostWarningContract(css, text, observation);
if (!contract) throw new Error("PUBLIC_WARNING_FIXTURE_DERIVATION_FAILED");
const iframes: string[] = [];
mock.module("@/components/regex/RegexIframe", () => ({
  RegexIframe: ({ srcdoc }: { srcdoc: string }) => {
    iframes.push(srcdoc);
    return <iframe title="unit-fallback" srcDoc={srcdoc} />;
  },
}));
const { FloatingSlot } = await import("@/components/chat/FloatingSlot");
const fixture = (html: string) => ({
  id: "warning-fixture",
  packId: "fixture",
  name: "public warning",
  content: html,
  enabled: true,
  orderIndex: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  slotValues: {},
});
const renderSlot = (html: string) =>
  renderToStaticMarkup(
    <FloatingSlot
      components={[fixture(html)]}
      character={{
        id: "fixture",
        name: "Fixture",
        avatarUrl: null,
        tags: [],
        bio: null,
      }}
      userName="test"
      onSendMessage={() => {
        throw Error("NO_AUTO_SEND");
      }}
    />,
  );
describe("finite observed public host warning candidate", () => {
  test("derives real source CSS variables/shape plus bound computed observation, never defaults an unknown warning", () => {
    expect(contract).not.toBeNull();
    expect(contract.text).toBe(text);
    expect(contract.height).toBe(28);
    expect(contract.observedWidth).toBeCloseTo(301.3333, 3);
    expect(contract.background).toBe("rgba(45, 55, 72, 0.85)");
    expect(contract.fontFamily).toBe("Huiwen, serif");
    expect(contract.color).toBe("rgb(226, 232, 240)");
    for (const [sheet, note] of [
      [css, undefined],
      ['.unrelated span::before{content:"x"}', observation],
      [css.replace("width: fit-content", "width: 600px"), observation],
      [css, { ...observation, text: "different card text" }],
      [css, { ...observation, font: "Huiwen; url(javascript:bad)" }],
    ] as const)
      expect(derivePublicHostWarningContract(sheet, text, note)).toBeNull();
  });
  test("safe converter markup survives actual opening routing and parses only exact plain markup", () => {
    const html = buildPublicHostWarningFloating(contract);
    const routed = routeOpeningContentSplit(html, "fixture");
    expect(routed.inline).toBeNull();
    expect(routed.floating.length).toBe(1);
    expect(routed.floating[0].meta.kind).toBe("warning-top");
    expect(parsePublicHostWarningContract(routed.floating[0].srcdoc)).toEqual(
      contract,
    );
    for (const altered of [
      `${routed.floating[0].srcdoc}<script>bad()</script>`,
      routed.floating[0].srcdoc.replace('class="flex-1"', 'onclick="bad()"'),
      '<div class="nj-mufy-warning">unknown</div>',
    ])
      expect(parsePublicHostWarningContract(altered)).toBeNull();
  });
  test("actual prepare migration uses native metadata only for exact observed family and retains unknown legacy warnings", () => {
    const base = {
      characterId: "warning-fixture",
      name: "Fixture",
      greeting: "公开开场",
      optimizationCode: css,
      codeRenderContent: "<div>公开组件</div>",
    };
    const run = (
      detail: typeof base & { sourceWarningObservation?: unknown },
    ) =>
      prepareMufyMigration({
        detail,
        promptRecord: {
          characterName: "Fixture",
          prompt:
            "<CharaPrompt>测试人物</CharaPrompt><Greeting>公开开场</Greeting>",
          source: {},
        },
      });
    const yes = run({ ...base, sourceWarningObservation: observation });
    expect(yes.beautification.openingComponent).toContain(
      "data-nj-public-warning",
    );
    expect(yes.beautification.openingComponent).not.toContain(
      ".nj-mufy-warning{height:54px",
    );
    expect(yes.beautification.openingComponent).toContain("公开组件");
    const no = run(base);
    expect(yes.beautification.globalCss).toBe(no.beautification.globalCss);
    expect(yes.character).toEqual(no.character);
    expect(no.beautification.openingComponent).toContain(
      ".nj-mufy-warning{height:54px",
    );
    expect(no.beautification.openingComponent).not.toContain(
      "data-nj-public-warning",
    );
    const otherFamily = run({
      ...base,
      optimizationCode: css.replace("width: fit-content", "width: 600px"),
      sourceWarningObservation: observation,
    });
    expect(otherFamily.beautification.openingComponent).toContain(
      ".nj-mufy-warning{height:54px",
    );
  });
  test("actual FloatingSlot emits fit-content28 native box, no iframe shield; legacy remains54px iframe", () => {
    iframes.length = 0;
    const html = renderSlot(buildPublicHostWarningFloating(contract));
    const dom = new JSDOM(html),
      doc = dom.window.document;
    const root = doc.querySelector("#nj_public_source_warning");
    if (!root) throw new Error("NATIVE_PUBLIC_WARNING_MISSING");
    expect(root.className).toBe(PUBLIC_WARNING_CLASSES);
    expect(root.querySelector("span.flex-1")?.textContent).toBe(text);
    expect(root.querySelectorAll("svg").length).toBe(2);
    expect(root.querySelector("button")?.getAttribute("aria-label")).toBe(
      "关闭提示",
    );
    expect(doc.querySelectorAll("iframe").length).toBe(0);
    expect(iframes).toHaveLength(0);
    expect(root.parentElement?.className).toContain("h-[28px]");
    expect(root.parentElement?.className).toContain("w-fit");
    expect(root.parentElement?.className).not.toContain("600px");
    dom.window.close();
    iframes.length = 0;
    const legacy = renderSlot(
      '<floating kind="warning-top" pos="top-center"><div class="nj-mufy-warning">unknown notice</div></floating>',
    );
    expect(legacy).toContain("h-[54px]");
    expect(iframes).toHaveLength(1);
  });
  test("native close delegates only to existing dismissal callback and text remains literal, never arbitrary HTML", () => {
    let dismissed = 0;
    const element = MufyPublicWarningCandidate({
      contract,
      onDismiss: () => {
        dismissed++;
      },
    });
    const children = Children.toArray(element.props.children);
    const box = children.find(
      (x) => isValidElement(x) && x.type === "div",
    ) as ReactElement<{ children: ReactNode }>;
    const button = Children.toArray(box.props.children).find(
      (x) => isValidElement(x) && x.type === "button",
    ) as ReactElement<{ onClick: () => void }>;
    button.props.onClick();
    expect(dismissed).toBe(1);
    const html = renderToStaticMarkup(
      <MufyPublicWarningCandidate
        contract={{ ...contract, text: "<img src=x onerror=bad()>" }}
        onDismiss={() => {}}
      />,
    );
    const dom = new JSDOM(html);
    expect(
      dom.window.document.querySelectorAll("img,script,iframe").length,
    ).toBe(0);
    expect(dom.window.document.querySelector("span.flex-1")?.textContent).toBe(
      "<img src=x onerror=bad()>",
    );
    dom.window.close();
  });
  test("unsafe paint or additional contract fields never reach native HTML or CSS", () => {
    expect(() =>
      buildPublicHostWarningFloating({
        ...contract,
        background: "url(javascript:bad)",
      }),
    ).toThrow("INVALID_PUBLIC_WARNING_CONTRACT");
    const routed = routeOpeningContentSplit(
      buildPublicHostWarningFloating(contract),
      "bad-fixture",
    );
    const before = routed.floating[0].srcdoc;
    const altered = before.replace(
      encodeURIComponent(JSON.stringify(contract)),
      encodeURIComponent(
        JSON.stringify({ ...contract, html: "<script>bad()</script>" }),
      ),
    );
    expect(parsePublicHostWarningContract(altered)).toBeNull();
    expect(
      derivePublicHostWarningContract(css, text, {
        ...observation,
        bg: "url(https://invalid.test/image)",
      }),
    ).toBeNull();
  });
});
