import { describe, expect, test } from "bun:test";
import {
  decodeFloatingSourceGeometry,
  encodeFloatingSourceGeometry,
  FLOATING_SOURCE_GEOMETRY_MAX_ATTRIBUTE_LENGTH,
  floatingSourceGeometryStyle,
  floatingSourceRect,
  parseFloatingSourceGeometry,
} from "./floating-source-geometry";

const orb85 = {
  version: 1 as const,
  bottomPx: 140,
  rightPx: 16,
  collapsed: { width: 48, height: 78 },
  expanded: { width: 48, height: 78 },
};

describe("bounded source floating geometry opt-in", () => {
  test("rank85 bottom anchor stays140px on phone and desktop, never vh", () => {
    expect(
      floatingSourceRect(orb85, false, { width: 390, height: 844 }),
    ).toEqual({ left: 326, top: 626, width: 48, height: 78 });
    expect(
      floatingSourceRect(orb85, true, { width: 1279, height: 503 }),
    ).toEqual({ left: 1215, top: 285, width: 48, height: 78 });
    expect(floatingSourceGeometryStyle(orb85, true)).toEqual({
      position: "fixed",
      top: "auto",
      bottom: 140,
      right: 16,
      width: 48,
      height: 78,
      transform: "none",
    });
  });

  test("top anchor, optional expanded dimensions and missing-expanded fallback", () => {
    const geometry = {
      version: 1,
      topPx: 80,
      rightPx: 4,
      collapsed: { width: 24, height: 32 },
    };
    expect(floatingSourceGeometryStyle(geometry, true)?.height).toBe(32);
    expect(
      floatingSourceGeometryStyle(
        { ...geometry, expanded: { width: 300, height: 400 } },
        true,
      ),
    ).toEqual({
      position: "fixed",
      top: 80,
      bottom: "auto",
      right: 4,
      width: 300,
      height: 400,
      transform: "none",
    });
  });

  test("clamps anchors and size to viewport edges including a tiny viewport", () => {
    const wide = {
      ...orb85,
      bottomPx: 1200,
      rightPx: 100,
      expanded: { width: 500, height: 800 },
    };
    expect(floatingSourceRect(wide, true, { width: 390, height: 600 })).toEqual(
      { left: 0, top: 0, width: 390, height: 600 },
    );
    expect(
      floatingSourceGeometryStyle(wide, true, { width: 390, height: 600 }),
    ).toEqual({
      position: "fixed",
      top: "auto",
      bottom: 0,
      right: 0,
      width: 390,
      height: 600,
      transform: "none",
    });
    expect(floatingSourceRect(orb85, false, { width: 10, height: 8 })).toEqual({
      left: 0,
      top: 0,
      width: 10,
      height: 8,
    });
  });

  test("finite boundary values are accepted", () => {
    expect(
      parseFloatingSourceGeometry({
        version: 1,
        topPx: 0,
        rightPx: 0,
        collapsed: { width: 16, height: 16 },
      }),
    ).not.toBeNull();
    expect(
      parseFloatingSourceGeometry({
        version: 1,
        topPx: 1200,
        rightPx: 100,
        collapsed: { width: 500, height: 800 },
      }),
    ).not.toBeNull();
    expect(
      parseFloatingSourceGeometry({ ...orb85, rightPx: 16.5 }),
    ).not.toBeNull();
  });

  test("rejects absent opt-in, ambiguous anchors and unknown capabilities", () => {
    for (const value of [
      undefined,
      null,
      [],
      {},
      { ...orb85, version: 2 },
      { ...orb85, topPx: 0 },
      { ...orb85, bottomPx: undefined },
      { ...orb85, sandbox: "allow-same-origin" },
      { ...orb85, permissions: [] },
      { ...orb85, html: "<script>1</script>" },
      { ...orb85, color: "red" },
      { ...orb85, expanded: undefined },
      { ...orb85, collapsed: { width: 48, height: 78, position: "fixed" } },
    ])
      expect(parseFloatingSourceGeometry(value)).toBeNull();
    expect(floatingSourceGeometryStyle(undefined, false)).toBeUndefined();
  });

  test("rejects strings, nonfinite numbers and out-of-range geometry", () => {
    for (const invalid of ["140px", "20vh", NaN, Infinity, -1, 1201]) {
      expect(
        parseFloatingSourceGeometry({ ...orb85, bottomPx: invalid }),
      ).toBeNull();
    }
    for (const invalid of ["16", NaN, Infinity, -1, 101]) {
      expect(
        parseFloatingSourceGeometry({ ...orb85, rightPx: invalid }),
      ).toBeNull();
    }
    for (const [width, height] of [
      [15, 78],
      [501, 78],
      [48, 15],
      [48, 801],
      [NaN, 78],
      [48, Infinity],
    ]) {
      expect(
        parseFloatingSourceGeometry({ ...orb85, collapsed: { width, height } }),
      ).toBeNull();
    }
  });

  test("defensive copies prevent later mutations and reject accessor/symbol fields", () => {
    const input = structuredClone(orb85);
    const parsed = parseFloatingSourceGeometry(input);
    input.collapsed.width = 100;
    expect(parsed?.collapsed.width).toBe(48);
    const accessor = {
      ...orb85,
      get rightPx() {
        throw new Error("must not execute");
      },
    };
    expect(parseFloatingSourceGeometry(accessor)).toBeNull();
    expect(
      parseFloatingSourceGeometry({ ...orb85, [Symbol("permission")]: true }),
    ).toBeNull();
  });

  test("attribute URI roundtrip, malformed and oversized values fail closed", () => {
    const attribute = encodeFloatingSourceGeometry(orb85);
    expect(attribute.startsWith("%7B")).toBe(true);
    expect(decodeFloatingSourceGeometry(attribute)).toEqual(orb85);
    for (const value of [
      "",
      "%",
      "%7B",
      "%00",
      "null",
      "[]",
      3,
      "x".repeat(FLOATING_SOURCE_GEOMETRY_MAX_ATTRIBUTE_LENGTH + 1),
      encodeURIComponent(JSON.stringify({ ...orb85, script: "alert(1)" })),
    ])
      expect(decodeFloatingSourceGeometry(value)).toBeNull();
    expect(() =>
      encodeFloatingSourceGeometry({ ...orb85, bottomPx: "140px" }),
    ).toThrow();
  });

  test("invalid viewports never produce NaN or unbounded styles", () => {
    for (const viewport of [
      { width: 0, height: 100 },
      { width: 100, height: 0 },
      { width: Infinity, height: 100 },
      { width: 100, height: NaN },
    ]) {
      expect(floatingSourceRect(orb85, false, viewport)).toBeNull();
      expect(
        floatingSourceGeometryStyle(orb85, false, viewport),
      ).toBeUndefined();
    }
  });
});
