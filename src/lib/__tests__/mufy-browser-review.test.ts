import { expect, test } from "bun:test";
import {
  reviewMufyBrowserRuns,
  buildMufyRepairQueue,
  assembleMufyBrowserSteps,
} from "../import/mufy-browser-review";
const expected = {
  characterId: "card",
  baseUrl: "http://test.local",
  notBefore: "2026-01-01T00:00:00Z",
};
test("checkpoint steps survive resumption but never pad missing states", () => {
  const runs = fixture().flatMap((run) =>
    run.rows.map((row) => ({ ...run, inspectionId: "one", rows: [row] })),
  );
  expect(
    reviewMufyBrowserRuns(assembleMufyBrowserSteps(runs, "one"), expected)
      .structuralOk,
  ).toBe(true);
  expect(
    reviewMufyBrowserRuns(
      assembleMufyBrowserSteps(runs.slice(1), "one"),
      expected,
    ).structuralOk,
  ).toBe(false);
  expect(assembleMufyBrowserSteps(runs, "other")).toHaveLength(0);
});
test("authorized media-only pending component is deferred, never silently fixed", () => {
  const a = fixture();
  const f = a[0].rows[0].frames[0];
  f.textChars = 0;
  // Browser fixtures intentionally exercise unknown external JSON shapes.
  Object.assign(f, {
    images: [
      {
        src: "https://source.example/optional.gif",
        complete: false,
        loaded: false,
      },
    ],
  });
  expect(reviewMufyBrowserRuns(a, expected).structuralOk).toBe(false);
  const r = reviewMufyBrowserRuns(a, { ...expected, allowMediaDeferral: true });
  expect(r.structuralOk).toBe(true);
  expect(r.deferredMedia.length).toBeGreaterThan(0);
  expect(r.finalFidelityAccepted).toBe(false);
});
function fixture() {
  return ["chat", "characters"].flatMap((surface) =>
    [390, 1280].map((width) => ({
      scope: "browser-structural-and-native-fold-only",
      url: `http://test.local/${surface}/card`,
      width,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      executionMs: 10,
      findings: [],
      actions: [],
      rows: ["initial", "expanded", "collapsed", "reopened"].map((state) => ({
        state,
        frames: [
          {
            title: "regex-opening",
            textChars: 40,
            bodyHeight: 100,
            images: [],
            overflowPx: 0,
            unresolvedUser: false,
            controls: [
              {
                visible: true,
                open: state === "expanded" || state === "reopened",
              },
            ],
          },
        ],
      })),
    })),
  );
}
test("four configurations never imply visual fidelity", () => {
  const r = reviewMufyBrowserRuns(fixture(), expected);
  expect(r.structuralOk).toBe(true);
  expect(r.finalFidelityAccepted).toBe(false);
  expect(reviewMufyBrowserRuns({runs: fixture()}, expected).structuralOk).toBe(true);
});
test("empty or wrong-target observations cannot pass", () => {
  const a = fixture();
  a[0].rows[0].frames = [];
  expect(reviewMufyBrowserRuns(a, expected).structuralOk).toBe(false);
  expect(
    reviewMufyBrowserRuns(fixture(), { ...expected, characterId: "another" })
      .structuralOk,
  ).toBe(false);
});
test("stale observations rejected after remigration", () => {
  expect(
    reviewMufyBrowserRuns(fixture(), {
      ...expected,
      notBefore: "2099-01-01T00:00:00Z",
    }).structuralOk,
  ).toBe(false);
});
test("one unopened control and recorded failed clicks produce repair tasks", () => {
  const a = fixture();
  a[0].rows[1].frames[0].controls.push({ visible: true, open: false });
  const r = reviewMufyBrowserRuns(a, expected);
  expect(r.findings.some((f) => f.code === "INCOMPLETE_FOLD_STATE")).toBe(true);
  expect(buildMufyRepairQueue(r.findings)[0].action).toBe(
    "repeat-browser-observation",
  );
});
test("raw measured defects override an empty findings array", () => {
  const a = fixture();
  a[0].rows[0].frames[0].overflowPx = 90;
  expect(
    reviewMufyBrowserRuns(a, expected).findings.some(
      (f) => f.code === "HORIZONTAL_OVERFLOW",
    ),
  ).toBe(true);
});
