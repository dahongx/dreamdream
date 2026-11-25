import { expect, test } from "bun:test";
import { assertMufyPublicCaptureIntegrity } from "../mufy-public-capture-integrity";

const complete = () => ({
  greeting: "完整开场🙂",
  componentMarkup: "<div>组件</div>",
  documents: ["", "<p>公开正文</p>"],
  styles: ["body{color:red}"],
  elapsedMs: 12.5,
});

test("validates strings without claiming a frame loaded or rejecting explicit empty documents", () => {
  expect(() =>
    assertMufyPublicCaptureIntegrity({
      ...complete(),
      frames: [{ srcdoc: "<p>body</p>", loaded: false, bodyLoaded: false }],
    }),
  ).not.toThrow();
  expect(() =>
    assertMufyPublicCaptureIntegrity({
      greeting: "",
      documents: [""],
      styles: [],
    }),
  ).not.toThrow();
});

test("rejects only terminal tool truncation markers with a precise field path", () => {
  for (const [capture, path] of [
    [{ ...complete(), greeting: "private author text[Truncated]" }, "greeting"],
    [
      { ...complete(), componentMarkup: "<div>[Truncated]\n " },
      "componentMarkup",
    ],
    [
      { ...complete(), documents: ["ok", "private[Truncated]"] },
      "documents[1]",
    ],
    [{ ...complete(), styles: ["private[Truncated]"] }, "styles[0]"],
  ] as const) {
    expect(() => assertMufyPublicCaptureIntegrity(capture)).toThrow(
      `MUFY_PUBLIC_CAPTURE_TRUNCATED:${path}`,
    );
    try {
      assertMufyPublicCaptureIntegrity(capture);
    } catch (error) {
      expect(String(error)).not.toContain("private");
    }
  }
  expect(() =>
    assertMufyPublicCaptureIntegrity({
      ...complete(),
      greeting: "作者解释[Truncated]这个词，但正文完整。",
    }),
  ).not.toThrow();
});

test("allows complete strings longer than 200000 characters", () => {
  const long = "x".repeat(250_000);
  expect(() =>
    assertMufyPublicCaptureIntegrity({
      greeting: long,
      componentMarkup: long,
      documents: [long],
      styles: [long],
      capturedLengths: {
        greeting: long.length,
        componentMarkup: long.length,
        documents: [long.length],
        styles: [long.length],
      },
    }),
  ).not.toThrow();
});

test("checks optional captured lengths in JavaScript UTF-16 units for every supported field", () => {
  const emoji = "🙂";
  expect(emoji.length).toBe(2);
  expect(() =>
    assertMufyPublicCaptureIntegrity({
      greeting: emoji,
      componentMarkup: emoji,
      documents: ["", emoji],
      styles: [emoji],
      capturedLengths: {
        greeting: 2,
        componentMarkup: 2,
        documents: [0, 2],
        styles: [2],
      },
    }),
  ).not.toThrow();
  for (const capturedLengths of [
    { greeting: 1 },
    { componentMarkup: 1 },
    { documents: [1, 2] },
    { styles: [1] },
  ]) {
    expect(() =>
      assertMufyPublicCaptureIntegrity({
        greeting: emoji,
        componentMarkup: emoji,
        documents: ["", emoji],
        styles: [emoji],
        capturedLengths,
      }),
    ).toThrow("MUFY_PUBLIC_CAPTURE_LENGTH_MISMATCH:capturedLengths.");
  }
});

test("rejects wrong length-array coverage, malformed lengths, and a missing measured component", () => {
  for (const capturedLengths of [
    { documents: [] },
    { styles: [14, 0] },
    { greeting: -1 },
    { greeting: NaN },
    { greeting: "6" },
    { documents: [0, undefined] },
  ])
    expect(() =>
      assertMufyPublicCaptureIntegrity({ ...complete(), capturedLengths }),
    ).toThrow();
  expect(() =>
    assertMufyPublicCaptureIntegrity({
      greeting: "",
      documents: [],
      styles: [],
      capturedLengths: { componentMarkup: 0 },
    }),
  ).toThrow("MUFY_PUBLIC_CAPTURE_MISSING_FIELD:componentMarkup");
});

test("rejects malformed capture field types including sparse arrays without printing content", () => {
  for (const capture of [
    null,
    [],
    { ...complete(), greeting: null },
    { ...complete(), componentMarkup: 5 },
    { ...complete(), documents: "not-array" },
    { ...complete(), documents: [undefined] },
    { ...complete(), documents: new Array(1) },
    { ...complete(), styles: [2] },
    { ...complete(), capturedLengths: null },
  ])
    expect(() => assertMufyPublicCaptureIntegrity(capture)).toThrow();
});

test("elapsedMs is optional, but a supplied value must be a finite positive number", () => {
  for (const elapsedMs of [NaN, Infinity, -Infinity, 0, -1, "12", null]) {
    expect(() =>
      assertMufyPublicCaptureIntegrity({ ...complete(), elapsedMs }),
    ).toThrow("MUFY_PUBLIC_CAPTURE_INVALID_ELAPSED_MS:elapsedMs");
  }
  expect(() =>
    assertMufyPublicCaptureIntegrity({ ...complete(), elapsedMs: 0.01 }),
  ).not.toThrow();
});
