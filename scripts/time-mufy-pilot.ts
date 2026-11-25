#!/usr/bin/env bun
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
const split = process.argv.indexOf("--");
const labelIndex = process.argv.indexOf("--label");
if (split < 0 || labelIndex < 0)
  throw new Error("--label <phase> -- <command> required");
const label = process.argv[labelIndex + 1];
const flag = (key: string) => { const i = process.argv.indexOf(key); return i >= 0 && i < split ? process.argv[i + 1] : undefined; };
const logPath = flag("--log") ?? "logs/mufy-profiles/full-20261013/pilot-5/repair-execution.jsonl";
const session = flag("--session") ?? process.env.MUFY_TIMING_SESSION ?? new Date().toISOString();
if (!label || labelIndex > split || !process.argv[split + 1]) throw Error("PHASE_AND_COMMAND_REQUIRED");
const startedAt = new Date().toISOString(),
  start = performance.now();
let exitCode = 1;
let launchError: string | undefined;
try {
  const child = Bun.spawn(process.argv.slice(split + 1), {
    stdout: "inherit",
    stderr: "inherit",
  });
  exitCode = await child.exited;
} catch (error) {
  launchError = error instanceof Error ? error.message : "command-launch-failed";
  console.error(launchError);
}
await mkdir(dirname(logPath), { recursive: true });
const finishedAt = new Date().toISOString(), elapsedMs = performance.now() - start;
await appendFile(
  logPath,
  JSON.stringify({
    session,
    runId: session,
    stepId: `${label}-${startedAt}`,
    kind: "compute",
    status: exitCode === 0 ? "ok" : "failed",
    measurement: "monotonic command elapsed time, not CPU or whole-agent net time",
    label,
    startedAt,
    finishedAt,
    elapsedMs,
    measuredExecutionMs: elapsedMs,
    exitCode,
    ...(launchError ? { launchError } : {}),
    excludes: [
      "user pauses",
      "agent analysis and development outside this command",
    ],
  }) + "\n",
);
process.exitCode = exitCode;
