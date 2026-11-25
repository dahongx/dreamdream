import { describe, expect, test } from "bun:test";
import { classifyModelStability, mapProbeHealthStatus } from "../model-status";

describe("classifyModelStability", () => {
  test("keeps never-observed models unknown", () => {
    expect(
      classifyModelStability({
        sampleCount: 0,
        successCount: 0,
        averageTtftMs: null,
      }),
    ).toBe("unknown");
  });

  test("uses a real request immediately without waiting for more samples", () => {
    expect(
      classifyModelStability({
        sampleCount: 1,
        successCount: 1,
        averageTtftMs: 500,
      }),
    ).toBe("smooth");
  });

  test("marks a reliable and responsive model smooth", () => {
    expect(
      classifyModelStability({
        sampleCount: 20,
        successCount: 19,
        averageTtftMs: 4_680,
      }),
    ).toBe("smooth");
  });

  test("marks slow or error-prone traffic congested", () => {
    expect(
      classifyModelStability({
        sampleCount: 10,
        successCount: 9,
        averageTtftMs: 15_000,
      }),
    ).toBe("congested");
    expect(
      classifyModelStability({
        sampleCount: 10,
        successCount: 8,
        averageTtftMs: 1_000,
      }),
    ).toBe("congested");
  });

  test("marks majority failure interrupted", () => {
    expect(
      classifyModelStability({
        sampleCount: 10,
        successCount: 4,
        averageTtftMs: 1_000,
      }),
    ).toBe("interrupted");
  });
});

describe("mapProbeHealthStatus", () => {
  test("maps persistent probe results to picker statuses", () => {
    expect(mapProbeHealthStatus("healthy")).toBe("smooth");
    expect(mapProbeHealthStatus("degraded")).toBe("congested");
    expect(mapProbeHealthStatus("unhealthy")).toBe("interrupted");
    expect(mapProbeHealthStatus("unknown")).toBe("unknown");
  });
});
