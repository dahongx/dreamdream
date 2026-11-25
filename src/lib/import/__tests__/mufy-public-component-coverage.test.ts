import { expect, test } from "bun:test";
import {
  publicComponentCoverage,
  publicRootComponentCoverage,
  singleMufyPublicOpeningRoot,
  type PublicComponentDisposition,
} from "../mufy-public-component-coverage";
const matched = (sourceIndex: number): PublicComponentDisposition => ({
  sourceIndex,
  status: "matched",
  evidence: "real-source-target-ui.json",
  targetUiVerified: true,
});
test("five successful exports cannot complete a ten-component source", () => {
  const r = publicComponentCoverage(
    10,
    Array.from({ length: 5 }, (_, i) => matched(i)),
  );
  expect(r.fullyChecked).toBe(false);
  expect(r.missing).toEqual([5, 6, 7, 8, 9]);
  expect(r.fullFidelityAccepted).toBe(false);
});
test("count equality without target UI evidence or concrete exceptions does not pass", () => {
  const r = publicComponentCoverage(3, [
    { ...matched(0), targetUiVerified: false },
    { sourceIndex: 1, status: "nonvisual-helper", evidence: "source.json" },
    {
      sourceIndex: 2,
      status: "source-unavailable",
      evidence: "source-target.json",
      reason: "exact original URL failed on both pages",
    },
  ]);
  expect(r.unresolved).toEqual([0, 1]);
  expect(r.fullyChecked).toBe(false);
});
test("source failures can be fully checked but never silently called perfect fidelity", () => {
  const r = publicComponentCoverage(2, [
    matched(0),
    {
      sourceIndex: 1,
      status: "source-unavailable",
      evidence: "exact-url-parity.json",
      reason: "both source and target failed to load original URL",
    },
  ]);
  expect(r.fullyChecked).toBe(true);
  expect(r.fullFidelityAccepted).toBe(false);
  expect(r.qualifiedSourceFailures).toEqual([1]);
});
test("unique helper disposition plus explicit fidelity verdict completes a real match", () => {
  const r = publicComponentCoverage(2, [
    { ...matched(0), fidelityVerified: true },
    {
      sourceIndex: 1,
      status: "nonvisual-helper",
      evidence: "source-geometry-and-behavior.json",
      reason:
        "zero-area platform resize bookkeeping, separately stripped from captured UI",
    },
  ]);
  expect(r.fullFidelityAccepted).toBe(true);
  expect(() => publicComponentCoverage(2, [matched(0), matched(0)])).toThrow();
  expect(publicComponentCoverage(0, []).fullFidelityAccepted).toBe(false);
});

test("every component being present is still not a visual and interaction acceptance", () => {
  const r = publicComponentCoverage(2, [matched(0), matched(1)]);
  expect(r.fullyChecked).toBe(true);
  expect(r.fidelityPending).toEqual([0, 1]);
  expect(r.fullFidelityAccepted).toBe(false);
});

test("root-local frame 0 in a second root is not covered by the first root mapping", () => {
  const roots = [
    { frames: [{ index: 0 }] },
    { frames: [{ index: 0 }, { index: 1 }] },
  ];
  const first = { ...matched(0), fidelityVerified: true };
  expect(publicRootComponentCoverage(roots, [first]).missing).toEqual([
    "1:0",
    "1:1",
  ]);
  const rows = [
    first,
    { ...first, sourceRootIndex: 1 },
    { ...matched(1), sourceRootIndex: 1, fidelityVerified: true },
  ];
  expect(publicRootComponentCoverage(roots, rows).fullFidelityAccepted).toBe(
    true,
  );
  expect(
    publicRootComponentCoverage(roots, [...rows, rows[1]]).duplicates,
  ).toEqual(["1:0"]);
  expect(
    publicRootComponentCoverage(roots, [{ ...first, sourceRootIndex: 9 }])
      .invalid,
  ).toEqual(["9:0"]);
});

test("legacy preparation refuses to discard a zero-area parent UI program in a later root", () => {
  const opening = "<p>public opening</p>";
  expect(
    singleMufyPublicOpeningRoot([{ html: opening }, { html: "  \n" }]),
  ).toBe(opening);
  expect(() =>
    singleMufyPublicOpeningRoot([
      { html: opening },
      { html: '<iframe style="height:0" srcdoc="player"></iframe>' },
    ]),
  ).toThrow("UNRESOLVED_ADDITIONAL_PUBLIC_ROOTS:1");
  expect(() => singleMufyPublicOpeningRoot([])).toThrow(
    "PUBLIC_OPENING_ROOT_REQUIRED",
  );
});
