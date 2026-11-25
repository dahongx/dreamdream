import { test, expect } from "bun:test";
import { createHash } from "node:crypto";
import { prepareRenderedOpening } from "../import/mufy-rendered-opening";
const greeting = "<meta>◇2025◇</meta>正文<定制指令组件正则>";
const greetingHash = createHash("sha256").update(greeting).digest("hex");
const capture = {
  version: 1 as const,
  roleId: "role",
  capturedAt: "2026-10-15T01:03:16Z",
  greetingSha256: greetingHash,
  sourceBinding: {
    roleId: "role",
    greetingSha256: greetingHash,
    responseCode: 200 as const,
    observedAt: "2026-10-15T01:03:00Z",
  },
  html: '<details><summary>状态</summary><table style="background:white;color:black"><tr><td>mufyer</td></tr></table></details>',
  frameCount: 0,
};
test("source renderer is bound to exact role and greeting, never all replies", () => {
  const r = prepareRenderedOpening(capture, "role", greeting, greeting);
  expect(new RegExp(r.pattern).test(greeting)).toBe(true);
  expect(new RegExp(r.pattern).test("a different reply")).toBe(false);
  expect(() =>
    prepareRenderedOpening(capture, "other", greeting, greeting),
  ).toThrow();
  expect(() =>
    prepareRenderedOpening(capture, "role", "changed", greeting),
  ).toThrow();
});
test("preserves source background and native folding, resolves user at host readiness", () => {
  const r = prepareRenderedOpening(capture, "role", greeting, greeting);
  expect(r.replacement).toContain("background:white;color:black");
  expect(r.replacement).toContain("host-ready");
  expect(r.replacement).toContain("context.userName");
  expect(r.replacement).toContain("d.open=false");
  expect(r.replacement).not.toContain('kind="island"');
});
test("rejects platform bridges and nested iframe payloads", () => {
  expect(() =>
    prepareRenderedOpening(
      { ...capture, html: "<iframe></iframe>" },
      "role",
      greeting,
      greeting,
    ),
  ).toThrow();
});
test("legacy textarea copy routes generated directive to composer without sending", () => {
  const r = prepareRenderedOpening(
    {
      ...capture,
      html: "<script>tempTx.select(); doc.execCommand('copy');</script>",
    },
    "role",
    greeting,
    greeting,
  );
  expect(r.replacement).toContain("window.host.fillComposer(tempTx.value)");
  expect(r.replacement).not.toContain("execCommand('copy')");
});
test("matches the real session-seeded body after metadata removal", () => {
  const raw = "before<system>visible source system box</system>after";
  const rawHash = createHash("sha256").update(raw).digest("hex");
  const c = {
    ...capture,
    greetingSha256: rawHash,
    sourceBinding: { ...capture.sourceBinding, greetingSha256: rawHash },
  };
  const r = prepareRenderedOpening(
    c,
    "role",
    raw,
    raw.replace(/system/g, "sys"),
  );
  expect(new RegExp(r.pattern).test("beforeafter")).toBe(true);
});
test("rejects legacy captures and locally relabelled greeting hashes", () => {
  const { sourceBinding: _, ...legacy } = capture;
  expect(() =>
    prepareRenderedOpening(
      legacy as typeof capture,
      "role",
      greeting,
      greeting,
    ),
  ).toThrow("public detail response binding");
  const changed = "different greeting";
  const relabelled = {
    ...capture,
    greetingSha256: createHash("sha256").update(changed).digest("hex"),
  };
  expect(() =>
    prepareRenderedOpening(relabelled, "role", changed, changed),
  ).toThrow("public detail response binding");
});
test("requires a successful role-matched response and a valid observation time", () => {
  for (const binding of [
    { ...capture.sourceBinding, roleId: "other" },
    { ...capture.sourceBinding, responseCode: 401 as 200 },
    { ...capture.sourceBinding, observedAt: "not-a-date" },
    { ...capture.sourceBinding, observedAt: "2026-10-15T01:05:00Z" },
  ])
    expect(() =>
      prepareRenderedOpening(
        { ...capture, sourceBinding: binding },
        "role",
        greeting,
        greeting,
      ),
    ).toThrow();
  expect(() =>
    prepareRenderedOpening(
      {
        ...capture,
        sourceBinding: {
          ...capture.sourceBinding,
          observedAt: "2026-10-15T01:04:15Z",
        },
      },
      "role",
      greeting,
      greeting,
    ),
  ).not.toThrow();
});
test("refresh validates capture provenance without assigning a new source hash", async () => {
  const script = await Bun.file(
    "scripts/refresh-mufy-rendered-captures.ts",
  ).text();
  expect(script).toMatch(/assertRenderedOpeningBinding\s*\(\s*capture/);
  expect(script).not.toMatch(/capture\.greetingSha256\s*=/);
  // Hashing synthetic fixtures in --self-test is legitimate; it must not be
  // confused with assigning a fresh source hash to an observed capture.
  const child = Bun.spawn(["bun", "scripts/refresh-mufy-rendered-captures.ts", "--self-test"], { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(child.stdout).text();
  expect(await child.exited).toBe(0);
  expect(JSON.parse(output).writesToRealFiles).toBe(0);
});
