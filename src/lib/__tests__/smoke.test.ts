/**
 * Sanity test — proves bun test runs in this project.
 * Real test coverage starts in W2.
 */

import { describe, expect, test } from "bun:test";

describe("project skeleton", () => {
  test("bun test runs", () => {
    expect(1 + 1).toBe(2);
  });
});
