import { expect, test } from "bun:test";
import { measureMufyStep, summarizeMufyTiming, type MufyTimingSpan } from "../import/mufy-execution-timing";

const span = (stepId: string, start: number, end: number, kind: MufyTimingSpan["kind"] = "compute"): MufyTimingSpan => ({ runId: "batch-5", stepId, kind, startedAt: new Date(start).toISOString(), finishedAt: new Date(end).toISOString(), elapsedMs: end - start, status: "ok" });
test("idle gaps and model waits are not agent active time", () => {
  const result = summarizeMufyTiming([span("a", 0, 10), span("wait", 10, 10000, "generation-wait"), span("b", 20000, 20040, "browser")], "batch-5");
  expect(result.activeWallMs).toBe(50);
  expect(result.measuredComputeMs).toBe(10);
  expect(result.measuredBrowserMs).toBe(40);
  expect(result.observedGenerationWaitMs).toBe(9990);
});
test("parallel spans are not double counted as active wall time", () => {
  expect(summarizeMufyTiming([span("a", 0, 100), span("b", 20, 60, "browser")], "batch-5").activeWallMs).toBe(100);
});
test("other batches are excluded and duplicate steps fail instead of inflating totals", () => {
  expect(summarizeMufyTiming([{ ...span("a", 0, 100), runId: "other" }], "batch-5").measuredSteps).toBe(0);
  expect(() => summarizeMufyTiming([span("a", 0, 10), span("a", 20, 30)], "batch-5")).toThrow("DUPLICATE");
});
test("invalid negative durations and nonfinite measurements are rejected", () => {
  for (const s of [span("a", 10, 0), { ...span("a", 0, 10), elapsedMs: NaN }, { ...span("a", 0, 10), elapsedMs: 50000 }]) expect(() => summarizeMufyTiming([s], "batch-5")).toThrow("INVALID");
});
test("failed operations are checkpointed without hiding their exception", async () => {
  const rows: MufyTimingSpan[] = [];
  await expect(measureMufyStep({runId:"batch-5",stepId:"failed",kind:"compute"}, async () => { throw Error("original"); }, async row => { rows.push(row); })).rejects.toThrow("original");
  expect(rows).toHaveLength(1); expect(rows[0].status).toBe("failed"); expect(rows[0].elapsedMs).toBeGreaterThanOrEqual(0);
});
