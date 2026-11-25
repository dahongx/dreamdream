import { expect, test } from "bun:test";
import { extractKnownPublicPrefix } from "../mufy-public-prefix-extractor";
function fixture(text = "public text") {
  const html = `<div id="mufy-bw-wrapper-restored"><style>@font-face { font-family: 'SourceHanSerifCN'; src: url('https://example.com/original.otf'); } #mufy-bw-panel {font-family:'SourceHanSerifCN'; border:none!important!; display:none; }</style><script>let appData = JSON.parse(localStorage.getItem('source-only'))||{presets:[{id:1,text:${JSON.stringify(text)}}],activeIds:[],insertMode:'before'};function getFullTextToSend(x){return x;}const mode='<div id="bw-mode-toggle" style="color:#fff;padding:2px">';throw Error('must never execute');</script></div>`;
  return (
    "<script>const fixedCoreContent = `" +
    html
      .replaceAll("\\", "\\\\")
      .replaceAll("`", "\\`")
      .replaceAll("${", "\\${")
      .replaceAll("</script>", "<\\/script>") +
    '`; const key="bw_draft_v1";</script>'
  );
}
test("public prefix extraction parses literals without executing storage or source programs", () => {
  const spec = extractKnownPublicPrefix(
    fixture("public\n{{user}} <tag>"),
    "fixture",
    "rgb(1, 2, 3)",
    "rgb(4, 5, 6)",
  );
  expect(spec.presets).toEqual([
    { id: "source-1", text: "public\n{{user}} <tag>" },
  ]);
  expect(spec.fontFace?.family).toMatch(/^nj_prefix_fixture_[a-f0-9]{8}$/);
  expect(spec.fontFace?.url).toBe("https://example.com/original.otf");
  expect(spec.css).not.toContain("@font-face");
  expect(spec.css).not.toContain("!important!");
  expect(spec.css).toContain("rgb(4, 5, 6)");
  expect(spec.css).toContain(`'${spec.fontFace?.family}'`);
  const changed = extractKnownPublicPrefix(
    fixture().replaceAll("original.otf", "updated.otf"),
    "fixture",
    "rgb(1, 2, 3)",
    "rgb(4, 5, 6)",
  );
  expect(changed.fontFace?.family).not.toBe(spec.fontFace?.family);
  expect(JSON.stringify(spec)).not.toContain("localStorage");
  expect(JSON.stringify(spec)).not.toContain("throw Error");
});
test("unknown/dynamic public templates and unobserved colors are rejected", () => {
  expect(() =>
    extractKnownPublicPrefix(
      '<script>const fixedCoreContent = compute(); const key="bw_draft_v1";</script>',
      "x",
      "rgb(1, 2, 3)",
      "rgb(1, 2, 3)",
    ),
  ).toThrow();
  expect(() =>
    extractKnownPublicPrefix(fixture(), "x", "red", "rgb(1, 2, 3)"),
  ).toThrow();
  expect(() =>
    extractKnownPublicPrefix(
      fixture().replace(
        "https://example.com/original.otf",
        "http://example.com/original.otf",
      ),
      "x",
      "rgb(1, 2, 3)",
      "rgb(1, 2, 3)",
    ),
  ).toThrow();
});
