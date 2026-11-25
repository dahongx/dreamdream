import { describe, expect, test } from "bun:test";
import { safeNextPath } from "../next-path";

describe("safeNextPath", () => {
  test("returns '/' for null / empty / undefined", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  test("accepts well-formed internal paths", () => {
    expect(safeNextPath("/share/abc")).toBe("/share/abc");
    expect(safeNextPath("/characters/123?foo=bar")).toBe(
      "/characters/123?foo=bar",
    );
    expect(safeNextPath("/")).toBe("/");
  });

  test("rejects open-redirect attempts", () => {
    // protocol-relative URL → would jump to attacker.com
    expect(safeNextPath("//evil.com/steal")).toBe("/");
    // absolute URL with scheme
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("http://evil.com")).toBe("/");
    // javascript: URI
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    // no leading slash
    expect(safeNextPath("share/abc")).toBe("/");
  });
});
