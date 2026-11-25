import { expect, test } from "bun:test";
import { artifactMinHeight } from "../regex/artifact-size";
import {
  nativeSourceBoxCss,
  nativeSourceBoxStyle,
  validNativeSourceBox,
} from "../opening/native-source-box";
import {
  extractNativeImageSidebars,
  nativeImageSidebarEnvelope,
} from "../opening/native-image-sidebar";

const box = {
  topVh: 20,
  rightPx: 0,
  triggerWidth: 68,
  triggerHeight: 48,
  triggerInsetRight: 20,
  openWidth: 260,
  openHeight: 448,
};

test("source drawer geometry keeps the trigger fixed and bounds the expanded panel", () => {
  expect(validNativeSourceBox(box)).toBe(true);
  expect(nativeSourceBoxStyle(box, false)).toEqual({
    top: "20vh",
    right: 0,
    width: 68,
    height: 48,
    transform: "none",
    pointerEvents: "none",
  });
  expect(nativeSourceBoxStyle(box, true).width).toBe(
    "min(260px,calc(100vw - 0px))",
  );
  expect(nativeSourceBoxCss(box)).not.toMatch(/background|color:|z-index/);
  for (const bad of [
    { ...box, topVh: Infinity },
    { ...box, openWidth: 501 },
    { ...box, triggerInsetRight: 69 },
    { ...box, openHeight: 1 },
  ])
    expect(validNativeSourceBox(bad)).toBe(false);
});

test("source sizing is opt-in and cannot alter unrelated sidebar variants", () => {
  const spec = {
    version: 1 as const,
    shellHtml:
      '<details class="mufy-side-r"><div data-nj-native-documents></div></details>',
    css: "",
    documents: ["<html><body>panel</body></html>"],
    sourceBox: box,
  };
  expect(
    extractNativeImageSidebars(nativeImageSidebarEnvelope(spec)).sidebars,
  ).toEqual([spec]);
  expect(
    extractNativeImageSidebars(
      nativeImageSidebarEnvelope({ ...spec, variant: "ins-music" } as never),
    ).sidebars,
  ).toHaveLength(0);
  expect(
    extractNativeImageSidebars(
      nativeImageSidebarEnvelope({
        ...spec,
        sourceBox: { ...box, rightPx: -1 },
      }),
    ).sidebars,
  ).toHaveLength(0);
});

test("artifact height accepts only explicit bounded root metadata", () => {
  expect(
    artifactMinHeight(
      '<!DOCTYPE html><html data-nj-iframe-min-height="1"><body>x</body></html>',
    ),
  ).toBe(1);
  expect(artifactMinHeight("<html data-nj-iframe-min-height='500'>")).toBe(500);
  for (const html of [
    '<html><body data-nj-iframe-min-height="1">',
    '<script>"<html data-nj-iframe-min-height=\"1\">"</script>',
    '<html data-nj-iframe-min-height="0">',
    '<html data-nj-iframe-min-height="501">',
    '<html><div data-nj-iframe-min-height="1">',
  ])
    expect(artifactMinHeight(html)).toBeUndefined();
});
