/** Explicit measured spans only. Idle gaps never become agent work. */
export type MufyTimingKind = "compute" | "browser" | "generation-wait";
export interface MufyTimingSpan {
  runId: string;
  stepId: string;
  kind: MufyTimingKind;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  status: "ok" | "failed";
}

export async function measureMufyStep<T>(
  identity: Pick<MufyTimingSpan, "runId" | "stepId" | "kind">,
  task: () => Promise<T>,
  save: (span: MufyTimingSpan) => Promise<void>,
): Promise<T> {
  if (!identity.runId.trim() || !identity.stepId.trim()) throw Error("TIMING_ID_REQUIRED");
  const startedAt = new Date().toISOString();
  const start = performance.now();
  let status: MufyTimingSpan["status"] = "failed";
  try {
    const result = await task();
    status = "ok";
    return result;
  } finally {
    await save({ ...identity, startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - start, status });
  }
}

export function summarizeMufyTiming(spans: MufyTimingSpan[], runId: string) {
  const seen = new Set<string>();
  const totals: Record<MufyTimingKind, number> = { compute: 0, browser: 0, "generation-wait": 0 };
  const intervals: Array<[number, number]> = [];
  let failed = 0;
  for (const span of spans.filter(s => s.runId === runId)) {
    const start = Date.parse(span.startedAt), end = Date.parse(span.finishedAt);
    if (!span.stepId.trim() || !["compute", "browser", "generation-wait"].includes(span.kind) || !["ok", "failed"].includes(span.status) || !Number.isFinite(start) || !Number.isFinite(end) || end < start || !Number.isFinite(span.elapsedMs) || span.elapsedMs < 0 || span.elapsedMs > end - start + 1000) throw Error("INVALID_TIMING_SPAN");
    if (seen.has(span.stepId)) throw Error("DUPLICATE_TIMING_STEP");
    seen.add(span.stepId);
    totals[span.kind] += span.elapsedMs;
    if (span.status === "failed") failed++;
    // Concurrent browser/model work must not inflate elapsed active wall time.
    if (span.kind !== "generation-wait") intervals.push([start, end]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let activeWallMs = 0, lastEnd = -Infinity;
  for (const [start, end] of intervals) {
    activeWallMs += Math.max(0, end - Math.max(start, lastEnd));
    lastEnd = Math.max(lastEnd, end);
  }
  return { runId, measuredSteps: seen.size, failed, measuredComputeMs: totals.compute,
    measuredBrowserMs: totals.browser, observedGenerationWaitMs: totals["generation-wait"],
    activeWallMs, scope: "recorded spans only; excludes unrecorded work, user pauses and scheduling gaps; not CPU time" };
}
