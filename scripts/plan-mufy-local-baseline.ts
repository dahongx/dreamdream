#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
if (!process.argv.includes("--local-baseline-authorized"))
  throw new Error(
    "Requires explicit user authorization to use the local Prompt baseline",
  );
const dir = resolve(process.argv[2] ?? "logs/mufy-profiles/full-20261013");
type AuditRow = {
  roleId: string;
  name: string;
  sourceKey: string;
  sourceName: string;
  promptSha256: string;
  detailStatus: string;
  observedAt: string;
  localAge: number | null;
  liveAge: number | null;
  openingExact: boolean;
  openingNarrativeEqual?: boolean;
  ageConflict: boolean;
  ageConflictResolvedByPublicTheater?: boolean;
  authorChanged: boolean;
  localPrimaryNameMismatch?: boolean;
  localPrimaryName?: string | null;
};
const audit = JSON.parse(
  await readFile(join(dir, "selection-identity-version-audit.json"), "utf8"),
) as { rows: AuditRow[] };
const selection = JSON.parse(
  await readFile(join(dir, "test-selection.json"), "utf8"),
) as { rows: { candidate: { roleId: string; name: string } }[] };
const selected = new Set(selection.rows.map((r) => r.candidate.roleId));
const priority = audit.rows.filter(
  (r) =>
    selected.has(r.roleId) &&
    r.detailStatus === "found" &&
    r.localPrimaryNameMismatch === false &&
    r.localPrimaryName !== null &&
    (r.openingExact || r.openingNarrativeEqual === true) &&
    r.localAge !== null &&
    (r.liveAge === r.localAge ||
      r.ageConflictResolvedByPublicTheater === true) &&
    !r.authorChanged,
);
const plan = {
  version: 1,
  createdAt: new Date().toISOString(),
  environment: "test",
  status: "preflight-plan-not-migrated",
  policy: {
    authorization: "User: 能用或者你能同步的就用呗",
    promptBaseline: "local-archive",
    latestHiddenPromptGuaranteed: false,
    synchronize: [
      "public-greeting",
      "public-theater",
      "public-styling",
      "public-media",
    ],
    forbidden: [
      "guess-hidden-persona",
      "blend-different-character-versions",
      "production-write",
    ],
  },
  priorityCount: priority.length,
  priority: priority.map((r) => ({
    roleId: r.roleId,
    name: r.name,
    sourceKey: r.sourceKey,
    promptSha256: r.promptSha256,
    observedAt: r.observedAt,
    publicOpeningSyncNeeded: !r.openingExact,
    evidence: !r.openingExact
      ? "Public opening narrative matches but HTML wrapping differs; synchronize public rendering without rewriting persona"
      : r.ageConflictResolvedByPublicTheater
        ? "Public opening matches; named public-theater age agrees with local persona despite conflicting basic age field"
        : "Public opening matches local archive after whitespace/Unicode normalization; basic age matches",
    next: "Fresh TEST duplicate/provenance check, runtime/media capture, dry-run and mobile/desktop acceptance before migration completion",
  })),
  remaining: selection.rows
    .filter((r) => !priority.some((p) => p.roleId === r.candidate.roleId))
    .map((r) => {
      const evidence = audit.rows.find((a) => a.roleId === r.candidate.roleId);
      return {
        roleId: r.candidate.roleId,
        name: r.candidate.name,
        next: evidence?.localPrimaryNameMismatch
          ? "Reject mismatched local Prompt identity; find another correctly indexed source"
          : !evidence
            ? "Read replacement details"
            : evidence.ageConflict
              ? "Reconcile basic age with public theater; do not rewrite persona"
              : evidence.openingExact
                ? "Confirm missing character identity facts"
                : "Compare public story/persona identity before synchronizing a different opening",
      };
    }),
};
await writeFile(
  join(dir, "local-baseline-plan.json"),
  JSON.stringify(plan, null, 2),
);
await writeFile(
  join(dir, "local-baseline-priority.txt"),
  [
    "本地档案版本：优先预检名单（尚未迁移，非线上隐藏Prompt最新版保证）",
    `公开开场与本地一致、年龄字段或有名人物小剧场年龄有一致证据：${priority.length}张。仍需测试服防重、运行态、资源与视觉验收。`,
    ...priority.map(
      (r, i) =>
        `${i + 1}. ${r.name} | ${r.localAge}岁 | https://chat.mufy.ai/chat?roleId=${r.roleId}`,
    ),
  ].join("\r\n") + "\r\n",
);
console.log(
  JSON.stringify({
    priority: priority.length,
    remaining: plan.remaining.length,
    serverWrites: 0,
  }),
);
