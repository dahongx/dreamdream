#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { publicAgeEvidence } from "../src/lib/import/mufy-public-age-evidence";
import { localIdentityFacts } from "../src/lib/import/mufy-local-identity";
import { openingsShareNarrative } from "../src/lib/import/mufy-opening-comparison";

// Evidence-only tool: does not approve profiles or write any server.
const dir = resolve(process.argv[2] ?? "logs/mufy-profiles/full-20261013");
const startedAt = new Date().toISOString();
type SelectionRow = {
  source: { key: string; name: string; promptSha256: string };
  candidate: { roleId: string; name: string; author: string | null };
};
type LiveRow = {
  roleId: string;
  status: string;
  name?: string;
  author?: string;
  age?: number;
  greeting?: string;
  description?: string;
  codeRenderContent?: unknown;
  updatedAt?: string;
  observedAt: string;
  elapsedMs: number;
  reason?: string;
};
const selection = JSON.parse(
  await readFile(join(dir, "selection-live-plan.json"), "utf8"),
) as { rows: SelectionRow[] };
const live = JSON.parse(
  await readFile(join(dir, "selection-live-evidence.json"), "utf8"),
) as {
  records: LiveRow[];
  startedAt: string;
  finishedAt?: string;
  status: string;
};
const job = JSON.parse(await readFile(join(dir, "job.json"), "utf8")) as {
  archive: string;
};
const wanted = new Set(selection.rows.map((r) => r.source.key));
const texts = new Map<
  string,
  { text: string; hash: string; fields: string[] }
>();
const child = spawn(
  process.argv[3] ?? "D:/program/anaconda3/Library/bin/zstd.exe",
  ["-dc", job.archive],
);
child.stderr.resume();
const exited = new Promise<void>((ok, fail) => {
  child.once("error", fail);
  child.once("close", (code) =>
    code === 0 ? ok() : fail(new Error(`Archive read failed (${code})`)),
  );
});
for await (const line of createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
})) {
  const value = JSON.parse(line) as { character_key: string; text: string };
  if (wanted.has(value.character_key))
    texts.set(value.character_key, {
      text: value.text,
      hash: createHash("sha256").update(value.text).digest("hex"),
      fields: Object.keys(value).filter((key) => key !== "text"),
    });
}
await exited;
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
const reports = selection.rows.map((r) => {
  const original = texts.get(r.source.key);
  const observation = live.records.find((d) => d.roleId === r.candidate.roleId);
  if (!original || original.hash !== r.source.promptSha256)
    throw new Error(`Archive fingerprint mismatch: ${r.source.key}`);
  const persona =
    original.text.match(/<CharaPrompt[^>]*>([\s\S]*?)<\/CharaPrompt>/i)?.[1] ??
    "";
  const opening =
    original.text.match(/<Greeting[^>]*>([\s\S]*?)<\/Greeting>/i)?.[1] ?? "";
  const facts = localIdentityFacts(persona);
  const localAge = facts.age === null ? undefined : String(facts.age);
  const primaryNameMismatch =
    facts.name !== null &&
    ![r.source.name, r.candidate.name].some((name) =>
      norm(name).includes(norm(facts.name as string)),
    );
  const liveAge = typeof observation?.age === "number" ? observation.age : null;
  const greeting =
    typeof observation?.greeting === "string" ? observation.greeting : "";
  const ageConflict =
    localAge !== undefined && liveAge !== null && Number(localAge) !== liveAge;
  const theaterAge = publicAgeEvidence(
    observation?.codeRenderContent,
    r.source.name,
    localAge === undefined ? null : Number(localAge),
  );
  const authorChanged =
    observation?.status === "found" &&
    typeof observation.author === "string" &&
    !!observation.author.trim() &&
    observation.author !== r.candidate.author;
  return {
    roleId: r.candidate.roleId,
    name: r.candidate.name,
    sourceKey: r.source.key,
    sourceName: r.source.name,
    localPrimaryName: facts.name,
    localPrimaryNameMismatch: primaryNameMismatch,
    localAgeDescription: facts.ageDescription,
    promptSha256: original.hash,
    localMetadataFields: original.fields,
    detailStatus: observation?.status ?? "not-collected",
    observedAt: observation?.observedAt,
    liveName: observation?.name,
    author: observation?.author,
    authorStatus: observation?.author?.trim()
      ? "detail-available"
      : "detail-missing-not-author-change",
    localAge: localAge === undefined ? null : Number(localAge),
    liveAge,
    ageConflict,
    publicTheaterAgeEvidence: theaterAge,
    ageConflictResolvedByPublicTheater: ageConflict && !!theaterAge,
    authorChanged,
    localOpeningAvailable: !!opening.trim(),
    liveOpeningAvailable: !!greeting.trim(),
    openingExact:
      !!opening.trim() && !!greeting.trim() && norm(opening) === norm(greeting),
    openingNarrativeEqual: openingsShareNarrative(opening, greeting),
    liveOpeningContainedInArchive:
      !!greeting.trim() && norm(original.text).includes(norm(greeting)),
    liveUpdatedAt: observation?.updatedAt,
    liveReason: observation?.reason,
    onlineFullPromptAvailable: false,
    identityStatus: primaryNameMismatch
      ? "source-prompt-identity-conflict"
      : "not-approved",
    versionStatus: "unproven",
    disposition: primaryNameMismatch
      ? "reject-source-prompt-identity"
      : observation?.status === "failed"
        ? "read-failed"
        : ageConflict || authorChanged
          ? "hold-conflict"
          : "hold-insufficient-version-evidence",
  };
});
const report = {
  version: 1,
  startedAt,
  finishedAt: new Date().toISOString(),
  accepted: 0,
  liveRun: {
    status: live.status,
    startedAt: live.startedAt,
    finishedAt: live.finishedAt,
    requestMs: live.records.reduce((n, r) => n + r.elapsedMs, 0),
  },
  summary: {
    requested: reports.length,
    readSuccess: reports.filter((r) => r.detailStatus === "found").length,
    readFailed: reports.filter((r) => r.detailStatus === "failed").length,
    ageConflicts: reports.filter((r) => r.ageConflict).length,
    sourcePromptIdentityConflicts: reports.filter(
      (r) => r.localPrimaryNameMismatch,
    ).length,
    ageConflictsWithNamedTheaterEvidence: reports.filter(
      (r) => r.ageConflictResolvedByPublicTheater,
    ).length,
    authorChanges: reports.filter((r) => r.authorChanged).length,
    detailAuthorMissing: reports.filter(
      (r) => r.authorStatus === "detail-missing-not-author-change",
    ).length,
    openingExact: reports.filter((r) => r.openingExact).length,
    openingNarrativeEqual: reports.filter((r) => r.openingNarrativeEqual)
      .length,
    openingContained: reports.filter((r) => r.liveOpeningContainedInArchive)
      .length,
    hiddenPromptVersionUnproven: reports.length,
  },
  rows: reports,
};
await writeFile(
  join(dir, "selection-identity-version-audit.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report.summary));
