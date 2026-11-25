import { expect, test } from "bun:test";
import { checkProfileProgress } from "../import/mufy-profile-monitor";

const snapshot = {
  jobId: "job",
  status: "running",
  startedAt: "2026-10-13T07:00:00Z",
  requests: 1,
  records: [{ complete: true, status: "found" }],
};
test("normal progress stays quiet", () => {
  const a = checkProfileProgress(snapshot, "job", null, "2026-10-13T07:00:00Z");
  expect(a.notify).toBe(false);
  expect(
    checkProfileProgress(
      { ...snapshot, requests: 2 },
      "job",
      a,
      "2026-10-13T07:05:00Z",
    ).notify,
  ).toBe(false);
});
test("pause notifies once and recovery notifies", () => {
  const a = checkProfileProgress(
    { ...snapshot, status: "AUTH_REQUIRED" },
    "job",
    null,
  );
  expect(a.notify).toBe(true);
  expect(
    checkProfileProgress({ ...snapshot, status: "AUTH_REQUIRED" }, "job", a)
      .notify,
  ).toBe(false);
  expect(checkProfileProgress(snapshot, "job", a).notify).toBe(true);
});
test("unchanged counts for ten minutes notify a stall", () => {
  const a = checkProfileProgress(snapshot, "job", null, "2026-10-13T07:00:00Z");
  const b = checkProfileProgress(snapshot, "job", a, "2026-10-13T07:05:00Z");
  expect(b.notify).toBe(false);
  expect(
    checkProfileProgress(snapshot, "job", b, "2026-10-13T07:10:00Z").condition,
  ).toBe("stalled");
});
test("new run resets stall baseline", () => {
  const a = checkProfileProgress(snapshot, "job", null, "2026-10-13T07:00:00Z");
  expect(
    checkProfileProgress(
      { ...snapshot, startedAt: "2026-10-13T08:00:00Z", requests: 0 },
      "job",
      a,
      "2026-10-13T08:00:00Z",
    ).condition,
  ).toBe("running");
});
test("completion with failed records is not complete success", () => {
  const a = checkProfileProgress(
    {
      ...snapshot,
      status: "finished",
      records: [{ complete: false, status: "failed" }],
    },
    "job",
    null,
  );
  expect(a.condition).toBe("finished-with-failures");
  expect(a.successful).toBe(0);
});
test("wrong job cannot be monitored", () => {
  expect(() => checkProfileProgress(snapshot, "other", null)).toThrow();
});
