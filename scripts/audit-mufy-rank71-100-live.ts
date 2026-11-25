/** Read-only aggregation. Never promotes imports or static checks to acceptance. */

import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseExternalCharacterXml } from "../src/lib/import/external-card";
import { assertMufyPublicCaptureIntegrity } from "../src/lib/import/mufy-public-capture-integrity";

const started = performance.now();
const output = resolve("outputs/mufy-rank71-100-coordination-20261111");
const groups = ["71-80", "81-90", "91-100"];
interface State {
  rank: number;
  name: string;
  status?: string;
  reason?: string | null;
  targetUrl?: string | null;
  fullFidelityAccepted?: boolean;
}
interface Capture {
  name: string;
  sourceUrl: string;
  greeting: string;
  componentMarkup?: string;
  documents: string[];
  styles: string[];
  observedAt: string;
  elapsedMs?: number;
  frames?: Array<{ loaded?: boolean; bodyLength?: number }>;
}
const manifest = JSON.parse(
  await readFile(
    resolve("outputs/mufy-local-archives-rank52-100-20261109/manifest.json"),
    "utf8",
  ),
) as { rows: Array<{ rank: number; name: string; sourceUrl: string }> };
async function optional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
const rows = [];
for (const group of groups) {
  const root = resolve(`outputs/mufy-rank${group}-20261111`);
  const checkpointRaw = await optional(join(root, "checkpoint.json"));
  const states = checkpointRaw
    ? (JSON.parse(checkpointRaw).cards as State[])
    : [];
  const [lo, hi] = group.split("-").map(Number);
  for (let rank = lo; rank <= hi; rank++) {
    const original = manifest.rows.find((row) => row.rank === rank)!;
    const state = states.find((row) => row.rank === rank);
    const findings: string[] = [];
    const dir = join(root, `rank${rank}`);
    // A held card is not opened or reprocessed by this audit.
    if (state?.status?.startsWith("held")) {
      rows.push({
        rank,
        name: original.name,
        status: "held",
        reason: state.reason,
        accepted: false,
        findings,
      });
      continue;
    }
    const receiptRaw = await optional(join(dir, "receipt.json"));
    const receipt = receiptRaw ? (JSON.parse(receiptRaw) as State) : null;
    const qaRaw = await optional(join(dir, "qa-state.json"));
    const qa = qaRaw
      ? (JSON.parse(qaRaw) as {
          fullFidelityAccepted?: boolean;
          observedAt?: string;
          remaining?: unknown[];
          supportedModelVerified?: string;
        })
      : null;
    const acceptanceAgrees =
      state?.fullFidelityAccepted === true &&
      qa?.fullFidelityAccepted === true &&
      Array.isArray(qa.remaining) &&
      qa.remaining.length === 0 &&
      !!qa.observedAt;
    if (state?.fullFidelityAccepted === true && !acceptanceAgrees)
      findings.push("CHECKPOINT_QA_ACCEPTANCE_CONFLICT");
    if (receipt && (receipt.rank !== rank || receipt.name !== original.name))
      findings.push("RECEIPT_IDENTITY_MISMATCH");
    const targetUrl = state?.targetUrl ?? receipt?.targetUrl ?? null;
    const captureRaw = await optional(join(dir, "public-capture.json"));
    let captureSummary = null;
    if (captureRaw) {
      const capture = JSON.parse(captureRaw) as Capture;
      try {
        assertMufyPublicCaptureIntegrity(capture);
      } catch (error) {
        findings.push(String(error));
      }
      const aliasRaw = await optional(join(dir, "identity-alias.json"));
      const alias = aliasRaw ? JSON.parse(aliasRaw) : null;
      const aliasVerified =
        alias?.verified === true &&
        alias.sourceUrl === original.sourceUrl &&
        alias.rosterName === original.name &&
        alias.publicName === capture.name &&
        Array.isArray(alias.matchingPublicFacts) &&
        alias.matchingPublicFacts.length >= 3;
      const unavailable = state?.status === "source-unavailable";
      if (
        !unavailable &&
        ((capture.name !== original.name && !aliasVerified) ||
          capture.sourceUrl !== original.sourceUrl)
      )
        findings.push("PUBLIC_IDENTITY_MISMATCH");
      if (!unavailable && (!capture.greeting?.trim() || !capture.observedAt))
        findings.push("PUBLIC_OPENING_OR_TIMESTAMP_MISSING");
      if (/\[Truncated(?:\]|\b)/i.test(captureRaw))
        findings.push("POSSIBLE_TRUNCATED_PUBLIC_CAPTURE");
      if (!Number.isFinite(capture.elapsedMs) || Number(capture.elapsedMs) <= 0)
        findings.push("BROWSER_ELAPSED_MISSING");
      if (capture.frames?.some((frame) => frame.loaded === false))
        findings.push("FRAME_RUNTIME_NOT_PROVEN_BY_CAPTURE");
      captureSummary = {
        observedAt: capture.observedAt,
        elapsedMs: capture.elapsedMs ?? null,
        unavailable,
        aliasVerified,
        greetingLength: capture.greeting?.length ?? 0,
        componentLength: capture.componentMarkup?.length ?? 0,
        documentCount: capture.documents?.length ?? 0,
        styleCount: capture.styles?.length ?? 0,
        sha256: createHash("sha256").update(captureRaw).digest("hex"),
      };
    }
    const prepared = [];
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const revision of entries
      .filter((name) => /^prepared(?:-v\d+)?$/.test(name))
      .sort()) {
      const xml = await optional(join(dir, revision, "ui-import.xml"));
      if (!xml) continue;
      const parsed = parseExternalCharacterXml(xml);
      if (!parsed.ok) {
        findings.push(`XML_PARSE_FAILED:${revision}`);
        continue;
      }
      const card = parsed.value.character;
      if (card.name !== original.name)
        findings.push(`XML_NAME_MISMATCH:${revision}`);
      if (!card.opening?.trim() || !card.persona?.trim())
        findings.push(`XML_REQUIRED_FIELDS_EMPTY:${revision}`);
      prepared.push({
        revision,
        xmlLength: xml.length,
        xmlSha256: createHash("sha256").update(xml).digest("hex"),
        openingLength: card.opening?.length ?? 0,
        personaLength: card.persona?.length ?? 0,
        outputSettingLength: card.outputSetting?.length ?? 0,
        componentLength: parsed.value.openingComponent?.length ?? 0,
        ruleCount: parsed.value.rules.length,
      });
    }
    rows.push({
      rank,
      name: original.name,
      status:
        targetUrl && !state?.targetUrl
          ? (receipt?.status ?? state?.status ?? "imported-private-qa-pending")
          : (state?.status ?? "pending"),
      reason: state?.reason ?? null,
      targetUrl,
      accepted: acceptanceAgrees,
      qa: qa
        ? {
            observedAt: qa.observedAt,
            fullFidelityAccepted: qa.fullFidelityAccepted === true,
            remaining: qa.remaining ?? null,
            supportedModelVerified: qa.supportedModelVerified ?? null,
          }
        : null,
      capture: captureSummary,
      prepared,
      findings,
    });
  }
}
const report = {
  observedAt: new Date().toISOString(),
  scope: "rank71-100; independent worker checkpoints remain authoritative",
  runtimeFingerprint:
    "c78ca773f4fb1f448fa9c57bcfaef2ae88d5700145047dc5d431b9305f59fea2",
  summary: {
    total: rows.length,
    held: rows.filter((row) => row.status === "held").length,
    pendingTimelineReview: rows.filter(
      (row) => row.status === "pending-timeline-safety-review",
    ).length,
    sourceUnavailable: rows.filter((row) => row.status === "source-unavailable")
      .length,
    captureFiles: rows.filter((row) => "capture" in row && row.capture).length,
    captured: rows.filter(
      (row) =>
        "capture" in row &&
        row.capture &&
        !row.capture.unavailable &&
        row.capture.greetingLength > 0,
    ).length,
    prepared: rows.filter((row) => "prepared" in row && row.prepared.length)
      .length,
    imported: rows.filter((row) => "targetUrl" in row && row.targetUrl).length,
    pendingImport: rows.filter(
      (row) =>
        !("targetUrl" in row && row.targetUrl) &&
        row.status !== "held" &&
        row.status !== "pending-timeline-safety-review" &&
        row.status !== "source-unavailable",
    ).length,
    accepted: rows.filter((row) => row.accepted).length,
    findings: rows.filter((row) => row.findings.length).length,
  },
  rows,
  elapsedMs: performance.now() - started,
  tokenUsage: null,
  databaseAccess: false,
  networkAccess: false,
};
await mkdir(output, { recursive: true });
await writeFile(
  join(output, "current-static-audit.json"),
  JSON.stringify(report, null, 2),
);
const tableCell = (value: unknown) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ");
await writeFile(
  join(output, "CURRENT-STATUS.md"),
  [
    "# Rank71–100 当前状态",
    "",
    `汇总时间：${report.observedAt}`,
    "",
    `30 张原名单：私有导入 ${report.summary.imported}（其中整卡验收通过 ${report.summary.accepted}），待采集/导入 ${report.summary.pendingImport}；暂缓 ${report.summary.held}，关系时间线待确认 ${report.summary.pendingTimelineReview}，来源不可访问 ${report.summary.sourceUnavailable}。导入不等于通过，未通过项继续由 Agent 检查。`,
    "",
    "| 序号 | 角色 | 当前结论 | 测试页 | 未完成原因或限制 |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const target = "targetUrl" in row ? row.targetUrl : null;
      const reviewUrl = target?.replace(
        /\/characters\/([^/]+)\/edit$/,
        "/chat/$1",
      );
      const qa = "qa" in row ? row.qa : null;
      const remaining = qa?.remaining?.length
        ? qa.remaining.join("；")
        : row.reason;
      const label = row.accepted
        ? `已验收，保持私有${qa?.supportedModelVerified ? `（${qa.supportedModelVerified}）` : ""}`
        : row.status === "held"
          ? "暂缓"
          : row.status === "pending-timeline-safety-review"
            ? "时间线待确认"
            : row.status === "source-unavailable"
              ? "来源不可访问"
              : target
                ? "已导入，整卡待验"
                : "未导入";
      return `| ${row.rank} | ${tableCell(row.name)} | ${tableCell(label)} | ${reviewUrl ? `[打开](${reviewUrl})` : "—"} | ${tableCell(remaining ?? "见 worker 每卡检查点，不能由无备注推定通过")} |`;
    }),
    "",
    "本表不覆盖原名单、收藏/点赞快照或原始证据。以独立 worker 检查点和每卡 QA 状态共同确认通过；正在进行的 UI 变化可能稍后才写入。",
    "",
  ].join("\n"),
);
await appendFile(
  join(output, "timing-runs.jsonl"),
  JSON.stringify({
    observedAt: report.observedAt,
    stage: "local-capture-xml-audit",
    elapsedMs: report.elapsedMs,
    excludesBrowserAndWaiting: true,
    tokenUsage: null,
  }) + "\n",
);
console.log(JSON.stringify(report.summary));
console.log(
  JSON.stringify(
    rows
      .filter((row) => row.findings.length)
      .map((row) => ({ rank: row.rank, findings: row.findings })),
  ),
);
