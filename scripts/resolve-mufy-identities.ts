#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { decideIdentity } from "../src/lib/import/mufy-identity-decision";
import { validateTestInventory } from "../src/lib/import/mufy-profile-selection";
import type {
  ProfileSource,
  ProfileCandidate,
} from "../src/lib/import/mufy-profiles";
const dir = resolve(process.argv[2] ?? "logs/mufy-profiles/full-20261013");
const read = async (name: string) =>
  JSON.parse(await readFile(join(dir, name), "utf8"));
type PoolRow = {
  source: ProfileSource;
  candidate: ProfileCandidate;
  observedAt: string;
};
type Local = {
  sourceKey: string;
  promptSha256: string;
  primaryName: string | null;
  persona: string;
  opening: string;
  age: number | null;
};
type Live = {
  roleId: string;
  name: string;
  status: string;
  greeting?: string;
  description?: string;
  codeRenderContent?: unknown;
  age?: number;
  observedAt: string;
};
const pool = (await read("identity-pool.json")) as {
  rows: PoolRow[];
  requested: number;
};
const cache = (await read("identity-source-cache.json")) as { rows: Local[] };
const evidence = (await read("identity-live-evidence.json")) as {
  records: Live[];
};
const inventory = validateTestInventory(await read("test-inventory.json"));
const decisions = pool.rows.map((row) => {
  const local = cache.rows.find((r) => r.sourceKey === row.source.key);
  if (!local || local.promptSha256 !== row.source.promptSha256)
    throw new Error("Identity source fingerprint mismatch");
  const live = evidence.records.find((r) => r.roleId === row.candidate.roleId);
  return {
    roleId: row.candidate.roleId,
    name: row.candidate.name,
    author: row.candidate.author,
    favorites: row.candidate.favorites,
    popularityObservedAt: row.observedAt,
    sourceKey: row.source.key,
    promptSha256: row.source.promptSha256,
    observedAt: live?.observedAt,
    ...decideIdentity(row.source.name, local, live, inventory.characters),
  };
});
const seenSourceKeys = new Set<string>();
const confirmed = decisions.filter((r) => {
  if (r.status !== "confirmed" || seenSourceKeys.has(r.sourceKey)) return false;
  seenSourceKeys.add(r.sourceKey);
  return true;
});
const selected = confirmed.slice(0, 100);
const result = {
  version: 1,
  updatedAt: new Date().toISOString(),
  scope: "identity-selection-only",
  metric: "favorites",
  policy:
    "local-archive-baseline-public-content-sync; hidden-latest-version-not-guaranteed",
  inventoryCapturedAt: inventory.capturedAt,
  examined: decisions.filter((r) => r.status !== "awaiting-read").length,
  historicalEvidenceRecords: evidence.records.length,
  pool: pool.rows.length,
  confirmed: confirmed.length,
  selected: selected.length,
  complete: selected.length === 100,
  migrationPreflightRun: false,
  serverWrites: 0,
  rows: selected,
  decisions,
};
await writeFile(
  join(dir, "confirmed-role-identities.json"),
  JSON.stringify(result, null, 2),
);
if (selected.length === 100) {
  const display = (value: unknown) =>
    String(value ?? "未提供").replace(/[\r\n\t]/g, " ");
  await writeFile(
    join(dir, "最终100角色名单.txt"),
    [
      "最终100角色名单：角色身份已确定（不含迁移预检或写库）",
      `生成时间（北京时间）：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`,
      `从收藏排序候选池${pool.rows.length}张中，已读取并判定${result.examined}张；按充分身份对应证据确定100张。`,
      "同一Mufy roleId及同一本地档案不重复占名额；已对照测试库存名称、公开简介及人物设定指纹排除已有。",
      "版本标准：用户提供的本地档案为底稿，公开内容可同步；不保证隐藏Prompt为线上最新版。",
      "不是Mufy全站Top100；证据不足者未纳入，单列待确认清单。热度为对应采集时的收藏快照。",
      "序号\t角色\t作者（搜索快照）\t收藏（采集快照）\t本地档案编号\t确认依据\t来源链接",
      ...selected.map((r, i) =>
        [
          i + 1,
          r.name,
          r.author,
          r.favorites,
          r.sourceKey,
          r.reason,
          `https://chat.mufy.ai/chat?roleId=${r.roleId}`,
        ]
          .map(display)
          .join("\t"),
      ),
    ].join("\r\n") + "\r\n",
  );
}
await writeFile(
  join(dir, "身份待确认清单.txt"),
  [
    "仅列已读到公开资料、但未取得充分人物对应证据的候选；不是判定人物错误。",
    "当前已采用本地档案版本标准；名单补位不会使用这些未确认关联。",
    ...decisions
      .filter((r) => r.status === "pending")
      .map(
        (r) =>
          `${r.name} | 来源${r.sourceKey} | ${r.reason} | https://chat.mufy.ai/chat?roleId=${r.roleId}`,
      ),
  ].join("\r\n") + "\r\n",
);
await writeFile(
  join(dir, "确定角色进度.txt"),
  [
    `只确定角色：${selected.length}/100（不是迁移预检、不是成品验收）`,
    `候选池${pool.rows.length}；有证据确认${confirmed.length}；测试库存时间${inventory.capturedAt}。`,
    "按本地档案版本，公开开场/人物资料作身份依据；不保证隐藏Prompt为线上最新版。",
    ...selected.map(
      (r, i) =>
        `${i + 1}. ${r.name} | 收藏${r.favorites} | ${r.reason} | https://chat.mufy.ai/chat?roleId=${r.roleId}`,
    ),
  ].join("\r\n") + "\r\n",
);
console.log(
  JSON.stringify({
    confirmed: confirmed.length,
    selected: selected.length,
    pending: decisions.filter((r) => r.status === "pending").length,
    awaitingRead: decisions.filter((r) => r.status === "awaiting-read").length,
    existing: decisions.filter((r) => r.status === "existing").length,
    rejected: decisions.filter((r) => r.status === "reject").length,
    complete: result.complete,
  }),
);
