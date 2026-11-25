export interface MonitorState {
  jobId: string;
  runStartedAt: string;
  checkedAt: string;
  lastProgressAt: string;
  successful: number;
  failed: number;
  requests: number;
  status: string;
  condition: string;
  notify: boolean;
}

export function checkProfileProgress(
  snapshot: unknown,
  jobId: string,
  previous: MonitorState | null,
  now = new Date().toISOString(),
): MonitorState {
  if (!snapshot || typeof snapshot !== "object")
    throw new Error("Missing live snapshot");
  const s = snapshot as Record<string, unknown>;
  if (
    s.jobId !== jobId ||
    !Array.isArray(s.records) ||
    typeof s.status !== "string" ||
    typeof s.startedAt !== "string" ||
    typeof s.requests !== "number" ||
    !Number.isSafeInteger(s.requests) ||
    s.requests < 0 ||
    !Number.isFinite(Date.parse(now))
  )
    throw new Error("Invalid monitor snapshot");
  const successful = s.records.filter(
    (r) => r.complete === true && r.status !== "failed",
  ).length;
  const failed = s.records.filter((r) => r.status === "failed").length;
  const sameRun =
    previous?.jobId === jobId && previous.runStartedAt === s.startedAt;
  const progressed =
    !sameRun ||
    previous.successful !== successful ||
    previous.requests !== s.requests;
  const lastProgressAt = progressed ? now : previous.lastProgressAt;
  const stalled =
    s.status === "running" &&
    Date.parse(now) - Date.parse(lastProgressAt) >= 10 * 60_000;
  const condition = stalled
    ? "stalled"
    : s.status === "finished" && failed > 0
      ? "finished-with-failures"
      : s.status;
  const actionable = condition !== "running";
  const sameJob = previous?.jobId === jobId;
  const recovered =
    sameJob && previous.condition !== "running" && condition === "running";
  return {
    jobId,
    runStartedAt: s.startedAt,
    checkedAt: now,
    lastProgressAt,
    successful,
    failed,
    requests: s.requests,
    status: s.status,
    condition,
    notify:
      recovered ||
      (actionable && (!sameJob || previous.condition !== condition)),
  };
}
