#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  appendFile,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import {
  TEST_PROFILE_HOST,
  requireVerifiedSelection,
  selectNewTestProfiles,
  validateTestInventory,
} from "../src/lib/import/mufy-profile-selection";
import {
  checkProfileProgress,
  type MonitorState,
} from "../src/lib/import/mufy-profile-monitor";
import {
  mergeObservations,
  type ProfileObservation,
  type ProfileReview,
  type ProfileSource,
  rankProfileCandidates,
  requireReviewedProfile,
  sourceFromRecord,
} from "../src/lib/import/mufy-profiles";

const command = process.argv[2];
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const required = (name: string) => {
  const v = arg(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
};
const dir = resolve(arg("--job-dir") ?? "logs/mufy-profiles/default");
const startedAt = new Date().toISOString();
await mkdir(dir, { recursive: true });
const json = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(join(dir, name), "utf8")) as T;
const save = async (name: string, value: unknown) => {
  const path = join(dir, name);
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${path}.tmp`, path);
};
const log = async (event: string, details: unknown = {}) =>
  appendFile(
    join(dir, "operations.jsonl"),
    `${JSON.stringify({ at: new Date().toISOString(), command, event, details })}\n`,
  );
async function* archiveRecords(path: string) {
  const child = path.endsWith(".zst")
    ? spawn(arg("--zstd-bin") ?? "zstd", ["-dc", path])
    : null;
  let stderr = "";
  child?.stderr.on("data", (b) => {
    stderr += b.toString().slice(0, 200);
  });
  const exited = child
    ? new Promise<void>((ok, fail) => {
        child.once("error", fail);
        child.once("close", (code) =>
          code === 0 ? ok() : fail(new Error(`zstd exited ${code}: ${stderr}`)),
        );
      })
    : Promise.resolve();
  const stream = child?.stdout ?? createReadStream(path);
  const decoder = new StringDecoder("utf8");
  let buffer = "",
    line = 0;
  for await (const chunk of stream) {
    buffer += decoder.write(chunk);
    let pos = buffer.indexOf("\n");
    while (pos >= 0) {
      const text = buffer.slice(0, pos).replace(/\r$/, "");
      buffer = buffer.slice(pos + 1);
      line++;
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON at record ${line}; raw Prompt omitted`);
      }
      yield { line, value };
      pos = buffer.indexOf("\n");
    }
  }
  buffer += decoder.end();
  if (buffer) {
    line++;
    let value: unknown;
    try {
      value = JSON.parse(buffer);
    } catch {
      throw new Error(`Invalid JSON at record ${line}; raw Prompt omitted`);
    }
    yield { line, value };
  }
  await exited;
}
const lockPath = join(dir, ".pipeline.lock");
const lock = await open(lockPath, "wx").catch(() => {
  throw new Error(
    "This job is already running or has a stale lock; verify the previous process before clearing it",
  );
});
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt, command }));
await log("started", { startedAt });
try {
  if (command === "inventory-test") {
    const sql =
      "BEGIN READ ONLY; SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT id,name,bio,avatar_url,cover_image_url,md5(btrim(persona)) AS persona_fingerprint FROM public.characters ORDER BY name,id) t; COMMIT;";
    const child = spawn("ssh", [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      `root@${TEST_PROFILE_HOST}`,
      `cd /root/projects/yearn-chat && docker compose exec -T db psql -X -q -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c \"${sql}\"`,
    ]);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.resume();
    const timer = setTimeout(() => child.kill(), 60_000);
    try {
      await new Promise<void>((ok, fail) => {
        child.once("error", fail);
        child.once("close", (code) =>
          code === 0
            ? ok()
            : fail(new Error(`TEST read-only inventory failed (${code})`)),
        );
      });
    } finally {
      clearTimeout(timer);
    }
    const inventory = validateTestInventory({
      version: 1,
      environment: "test",
      host: TEST_PROFILE_HOST,
      capturedAt: new Date().toISOString(),
      complete: true,
      characters: JSON.parse(output.trim()),
    });
    await save("test-inventory.json", inventory);
    console.log(
      JSON.stringify({
        environment: "test",
        characters: inventory.characters.length,
        capturedAt: inventory.capturedAt,
      }),
    );
  } else if (command === "prepare") {
    const archive = resolve(required("--archive"));
    const sources: ProfileSource[] = [];
    const keys = new Set<string>();
    for await (const { line, value } of archiveRecords(archive)) {
      const source = sourceFromRecord(value, line);
      if (keys.has(source.key)) throw new Error(`Duplicate key ${source.key}`);
      keys.add(source.key);
      sources.push(source);
    }
    const digest = createHash("sha256")
      .update(JSON.stringify(sources))
      .digest("hex");
    const existing = await readFile(join(dir, "job.json"), "utf8").catch(
      () => null,
    );
    if (existing && JSON.parse(existing).sourceDigest !== digest)
      throw new Error(
        "Job belongs to another source archive; choose a new job directory",
      );
    await save("job.json", {
      version: 1,
      archive,
      sourceDigest: digest,
      createdAt: existing ? JSON.parse(existing).createdAt : startedAt,
      sourceCount: sources.length,
    });
    await save("sources.json", sources);
    if (!existing) {
      await save("observations.json", []);
      await save("reviews.json", []);
    }
    console.log(
      JSON.stringify({
        jobDir: dir,
        sources: sources.length,
        sourceDigest: digest,
      }),
    );
  } else if (command === "queue") {
    const job = await json<{ sourceDigest: string }>("job.json"),
      sources = await json<ProfileSource[]>("sources.json"),
      observations = await json<ProfileObservation[]>("observations.json");
    const done = new Set(
      observations
        .filter((o) => o.complete && o.status !== "failed")
        .map((o) => o.key),
    );
    const rows = sources.filter((s) => !done.has(s.key));
    const limit = arg("--limit") ? Number(arg("--limit")) : rows.length;
    if (
      !Number.isSafeInteger(limit) ||
      limit < 0 ||
      (arg("--limit") && limit < 1)
    )
      throw new Error("Invalid --limit");
    const queue = {
      version: 1,
      jobId: job.sourceDigest,
      rows: rows.slice(0, limit).map((s) => ({ key: s.key, name: s.name })),
      request: { pageSize: 40, showNsfw: true, sortBy: "newest" },
      intervalMs: 1500,
      maxRetries: 3,
    };
    await save("browser-queue.json", queue);
    console.log(
      JSON.stringify({
        remaining: rows.length,
        queued: queue.rows.length,
        path: join(dir, "browser-queue.json"),
      }),
    );
  } else if (command === "ingest") {
    const snapshot = JSON.parse(
      await readFile(resolve(required("--snapshot")), "utf8"),
    );
    const job = await json<{ sourceDigest: string }>("job.json");
    if (
      snapshot.version !== 1 ||
      snapshot.jobId !== job.sourceDigest ||
      snapshot.request?.showNsfw !== true
    )
      throw new Error("Wrong job/schema/search scope");
    const merged = mergeObservations(
      await json<ProfileObservation[]>("observations.json"),
      snapshot.records,
      await json<ProfileSource[]>("sources.json"),
    );
    await save("observations.json", merged);
    await log("browser-snapshot", {
      records: snapshot.records.length,
      status: snapshot.status,
      activeMs: snapshot.activeMs,
      waitMs: snapshot.waitMs,
    });
    console.log(JSON.stringify({ observations: merged.length }));
  } else if (command === "monitor") {
    const snapshot: unknown = JSON.parse(
      await readFile(resolve(required("--snapshot")), "utf8"),
    );
    const job = await json<{ sourceDigest: string }>("job.json");
    const previous = await readFile(join(dir, "monitor-state.json"), "utf8")
      .then((s) => JSON.parse(s) as MonitorState)
      .catch(() => null);
    const state = checkProfileProgress(snapshot, job.sourceDigest, previous);
    await save("monitor-state.json", state);
    await log("monitor-check", state);
    console.log(JSON.stringify(state));
  } else if (command === "review" || command === "reject") {
    const key = required("--key"),
      roleId = required("--role-id"),
      evidence = required("--evidence");
    if (!evidence.trim()) throw new Error("Review evidence cannot be blank");
    const source = (await json<ProfileSource[]>("sources.json")).find(
      (s) => s.key === key,
    );
    if (!source) throw new Error("Unknown source key");
    const obs = (await json<ProfileObservation[]>("observations.json")).find(
      (o) => o.key === key && o.complete && o.status === "found",
    );
    if (!obs?.candidates.some((c) => c.roleId === roleId))
      throw new Error("Candidate not observed in a complete search");
    if (command === "reject") {
      const previous = await readFile(
        join(dir, "audited-rejections.json"),
        "utf8",
      )
        .then(
          (value) =>
            JSON.parse(value) as {
              rows: {
                roleId: string;
                sourceKey: string;
                promptSha256: string;
              }[];
            },
        )
        .catch((error: unknown) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          )
            return { rows: [] };
          throw error;
        });
      await save("audited-rejections.json", {
        version: 1,
        rows: [
          ...previous.rows.filter(
            (r) =>
              !(
                r.roleId === roleId &&
                r.sourceKey === key &&
                r.promptSha256 === source.promptSha256
              ),
          ),
          {
            roleId,
            sourceKey: key,
            promptSha256: source.promptSha256,
            name: source.name,
            reason: evidence,
            disposition: "replace-association",
            reviewedAt: new Date().toISOString(),
          },
        ],
      });
      await log("association-rejected", { key, roleId, evidence });
    } else {
      const reviews = await json<ProfileReview[]>("reviews.json");
      await save("reviews.json", [
        ...reviews.filter((r) => r.key !== key),
        {
          key,
          roleId,
          promptSha256: source.promptSha256,
          status: "confirmed",
          evidence,
          reviewedAt: new Date().toISOString(),
        },
      ]);
      await log("identity-confirmed", { key, roleId, evidence });
    }
  } else if (
    command === "rank" ||
    command === "handoff" ||
    command === "select"
  ) {
    if (command === "handoff")
      requireVerifiedSelection(await json<unknown>("test-selection.json"));
    const sources = await json<ProfileSource[]>("sources.json"),
      observations = await json<ProfileObservation[]>("observations.json"),
      reviews = await json<ProfileReview[]>("reviews.json");
    const metric = arg("--metric") ?? "favorites";
    if (!["likes", "favorites", "chats"].includes(metric))
      throw new Error("Unknown metric");
    const ranked = rankProfileCandidates(
      sources,
      observations,
      reviews,
      metric as "likes" | "favorites" | "chats",
      command === "handoff" || !process.argv.includes("--candidates"),
    );
    const auditedRejections = await readFile(
      join(dir, "audited-rejections.json"),
      "utf8",
    )
      .then(
        (value) =>
          JSON.parse(value) as {
            rows: {
              roleId: string;
              sourceKey: string;
              promptSha256: string;
              reason: string;
            }[];
          },
      )
      .catch((error: unknown) => {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return { rows: [] };
        throw error;
      });
    const eligibleRanked = ranked.filter(
      (row) =>
        !auditedRejections.rows.some(
          (rejection) =>
            rejection.roleId === row.candidate.roleId &&
            rejection.sourceKey === row.source.key &&
            rejection.promptSha256 === row.source.promptSha256,
        ),
    );
    const top = Number(arg("--top") ?? 100);
    if (!Number.isSafeInteger(top) || top < 1) throw new Error("Invalid --top");
    const uniqueRoles = process.argv.includes("--unique-roles");
    const seenRoles = new Set<string>();
    let selected = eligibleRanked
      .filter((row) => {
        if (!uniqueRoles) return true;
        if (seenRoles.has(row.candidate.roleId)) return false;
        seenRoles.add(row.candidate.roleId);
        return true;
      })
      .slice(0, top);
    if (
      command === "select" ||
      command === "handoff" ||
      arg("--test-inventory")
    ) {
      const inventory = validateTestInventory(
        JSON.parse(
          await readFile(
            resolve(
              arg("--test-inventory") ?? join(dir, "test-inventory.json"),
            ),
            "utf8",
          ),
        ),
      );
      const selection = selectNewTestProfiles(eligibleRanked, inventory, top);
      selected = selection.rows;
      await save("rejected-associations.json", {
        createdAt: new Date().toISOString(),
        rows: selection.rejectedPairs,
      });
      await save("pending-reviews.json", {
        status: "blocked-not-accepted",
        createdAt: new Date().toISOString(),
        reason:
          "Need live identity/version and historical target provenance verification; names alone are insufficient",
        rows: selected.map((row) => ({
          roleId: row.candidate.roleId,
          name: row.candidate.name,
          sourceKey: row.source.key,
          promptSha256: row.source.promptSha256,
          identityStatus: "pending",
          versionStatus: "pending",
          targetAbsenceStatus: "pending",
        })),
      });
      await save("test-selection.json", {
        version: 1,
        status: "draft-awaiting-identity-version-and-target-review",
        accepted: 0,
        environment: "test",
        createdAt: new Date().toISOString(),
        inventoryCapturedAt: inventory.capturedAt,
        inventoryCount: inventory.characters.length,
        metric,
        scope: "observed-only",
        requested: top,
        selected: selected.length,
        requiresIdentityAndVersionReview: true,
        auditedRejections: auditedRejections.rows,
        ...selection,
      });
      const printable = (value: unknown) =>
        String(value ?? "未提供").replace(/[\t\r\n]/g, " ");
      await writeFile(
        join(dir, "test-top100.txt"),
        [
          `待核对草稿（禁止迁移） | ${metric}降序 | ${selected.length}/${top}个；验收通过0个`,
          `测试服已有${inventory.characters.length}张卡；清单时间 ${inventory.capturedAt}；候选去重排除${selection.excluded.length}个。`,
          "范围：已采集候选，不是全站排行榜。同名/版本名称冲突保守排除，不证明同一卡；改名或别名仍需迁移前核对。",
          "搜索候选与本地Prompt身份/版本尚待确认；本名单不允许直接写库。",
          `已剔除${selection.rejectedPairs.length}条名称不相容的本地-线上关联；不是同等数量的角色。`,
          "序号\tMufy角色名\t作者\t收藏\t点赞\ttotalChats\t来源链接",
          ...selected.map((row, i) =>
            [
              i + 1,
              row.candidate.name,
              row.candidate.author,
              row.candidate.favorites,
              row.candidate.likes,
              row.candidate.chats,
              `https://chat.mufy.ai/chat?roleId=${row.candidate.roleId}`,
            ]
              .map(printable)
              .join("\t"),
          ),
        ].join("\r\n") + "\r\n",
      );
      console.log(
        JSON.stringify({
          selected: selected.length,
          excluded: selection.excluded.length,
          eligible: selection.eligibleCount,
          rejectedPairs: selection.rejectedPairs.length,
          accepted: 0,
        }),
      );
    }
    await save("ranking.json", {
      metric,
      uniqueRoles:
        command === "select" ||
        command === "handoff" ||
        !!arg("--test-inventory") ||
        uniqueRoles,
      scope: "observed-only",
      sourceCount: sources.length,
      observedCount: observations.length,
      confirmedOnly:
        command === "handoff" || !process.argv.includes("--candidates"),
      rows: selected,
    });
    if (command === "handoff") {
      const wanted = new Map(selected.map((row) => [row.source.key, row]));
      const job = await json<{ archive: string }>("job.json");
      await mkdir(join(dir, "handoff", "assembled"), { recursive: true });
      const roles = [];
      for await (const { value, line } of archiveRecords(job.archive)) {
        const source = sourceFromRecord(value, line),
          row = wanted.get(source.key);
        if (!row) continue;
        requireReviewedProfile(source, observations, reviews);
        const filename = `${source.key}_prompt.txt`;
        await writeFile(
          join(dir, "handoff", "assembled", filename),
          (value as { text: string }).text,
          { mode: 0o600 },
        );
        roles.push({
          localName: source.name,
          selector: `https://chat.mufy.ai/chat?roleId=${row.candidate.roleId}`,
          profileKey: source.key,
          promptSha256: source.promptSha256,
          promptJson: `assembled/${filename}`,
          enabled: true,
        });
      }
      if (roles.length !== selected.length)
        throw new Error("Selected records are missing from the source archive");
      await save("handoff/role-map.json", { version: 1, roles });
      console.log(
        JSON.stringify({
          selected: roles.length,
          handoffDir: join(dir, "handoff"),
          next: "Capture source runtime and call mufy:agent with --profiles-job and --profile-key; no server writes performed",
        }),
      );
    } else
      console.log(
        JSON.stringify({
          ranked: selected.length,
          observed: observations.length,
          scope: "observed-only",
        }),
      );
  } else if (command === "report") {
    const sources = await json<ProfileSource[]>("sources.json"),
      observations = await json<ProfileObservation[]>("observations.json"),
      reviews = await json<ProfileReview[]>("reviews.json");
    const observed = new Map(observations.map((o) => [o.key, o]));
    const cell = (value: unknown) => {
      let text = value === null || value === undefined ? "" : String(value);
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = (rows: unknown[][]) =>
      `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
    const roster: unknown[][] = [
      [
        "本地编号",
        "角色名",
        "别名",
        "采集状态",
        "候选数量",
        "采集时间UTC",
        "原包行号",
        "Prompt字符数",
        "PromptSHA256",
        "变体数量（不是热度）",
      ],
    ];
    const candidates: unknown[][] = [
      [
        "本地编号",
        "本地角色名",
        "候选角色名",
        "roleId",
        "作者",
        "标签",
        "点赞",
        "收藏",
        "totalChats",
        "采集时间UTC",
        "原卡更新时间UTC",
        "身份状态",
        "来源链接",
      ],
    ];
    for (const source of sources) {
      const o = observed.get(source.key);
      roster.push([
        source.key,
        source.name,
        source.aliases.join(" / "),
        o?.status ?? "pending",
        o?.candidates.length ?? null,
        o?.observedAt ?? null,
        source.archiveLine,
        source.promptChars,
        source.promptSha256,
        source.variantCount,
      ]);
      for (const c of o?.candidates ?? []) {
        const confirmed = reviews.some(
          (r) =>
            r.key === source.key &&
            r.roleId === c.roleId &&
            r.status === "confirmed" &&
            r.promptSha256 === source.promptSha256 &&
            r.evidence.trim(),
        );
        candidates.push([
          source.key,
          source.name,
          c.name,
          c.roleId,
          c.author,
          c.tags.join(" / "),
          c.likes,
          c.favorites,
          c.chats,
          o?.observedAt,
          c.updatedAt,
          confirmed ? "confirmed" : "candidate-unverified",
          `https://chat.mufy.ai/chat?roleId=${c.roleId}`,
        ]);
      }
    }
    await writeFile(join(dir, "roster.csv"), csv(roster));
    await writeFile(join(dir, "candidates.csv"), csv(candidates));
    await save("report-summary.json", {
      sources: sources.length,
      observed: observations.length,
      pending:
        sources.length -
        observations.filter((o) => o.complete && o.status !== "failed").length,
      candidateRows: candidates.length - 1,
      scope: "observed-only",
      request: { showNsfw: true },
      exportedAt: new Date().toISOString(),
    });
    console.log(
      JSON.stringify({
        rosterRows: roster.length - 1,
        candidateRows: candidates.length - 1,
        jobDir: dir,
      }),
    );
  } else if (command === "status") {
    const sources = await json<ProfileSource[]>("sources.json"),
      observations = await json<ProfileObservation[]>("observations.json");
    console.log(
      JSON.stringify({
        sources: sources.length,
        observations: observations.length,
        remaining:
          sources.length -
          observations.filter((o) => o.complete && o.status !== "failed")
            .length,
      }),
    );
  } else
    throw new Error(
      "Commands: prepare, queue, ingest, monitor, review, reject, rank, inventory-test, select, handoff, report, status",
    );
  await log("finished", { elapsedMs: Date.now() - Date.parse(startedAt) });
} catch (error) {
  await log("failed", {
    elapsedMs: Date.now() - Date.parse(startedAt),
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
} finally {
  await lock.close();
  await unlink(lockPath);
}
