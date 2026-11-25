#!/usr/bin/env bun

/**
 * Reusable batch agent for Mufy -> Dearm migrations.
 *
 * The agent intentionally uses a two-phase workflow: every selected card must
 * pass an online dry-run before any test-database write starts. A role map is
 * required so an ambiguous name search can never silently migrate another
 * creator's card.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

type Visibility = "public" | "private" | "unlisted";
type ContentType = "original" | "self_designed" | "fanwork";

interface RoleMapping {
  localName: string;
  selector: string;
  detailJson?: string;
  /** export-mufy-runtime.js 在登录页面导出的运行态快照。 */
  runtimeJson?: string;
  targetName?: string;
  minGreetingSimilarity?: number;
  enabled?: boolean;
  note?: string;
}

interface RoleMapFile {
  version: number;
  roles: RoleMapping[];
}

interface SourceManifestRecord {
  character_name: string;
  assembled_prompt?: string;
}

interface SourceManifest {
  records: SourceManifestRecord[];
}

interface Options {
  sourceDir: string;
  roleMapPath: string;
  reportDir: string;
  only: Set<string> | null;
  ownerEmail?: string;
  expectedDbHost?: string;
  visibility: Visibility;
  nsfw?: boolean;
  contentType: ContentType;
  commit: boolean;
}

const MUFY_ORIGIN = "https://chat.mufy.ai";
const ROLE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function enumArgument<T extends string>(
  flag: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = argumentValue(flag);
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T)) {
    throw new Error(`${flag} 只能是 ${allowed.join(" / ")}`);
  }
  return value as T;
}

function booleanArgument(flag: string): boolean | undefined {
  const value = argumentValue(flag);
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${flag} 只能是 true 或 false`);
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

function parseOptions(): Options {
  const sourceDir = resolve(argumentValue("--source-dir") ?? "hot_0926");
  const onlyValue = argumentValue("--only");
  return {
    sourceDir,
    roleMapPath: resolve(
      argumentValue("--role-map") ?? join(sourceDir, "mufy-role-map.json"),
    ),
    reportDir: resolve(
      argumentValue("--report-dir") ??
        join(sourceDir, "migration-agent-reports", timestamp()),
    ),
    only: onlyValue
      ? new Set(
          onlyValue
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
        )
      : null,
    ownerEmail: argumentValue("--owner-email"),
    expectedDbHost: argumentValue("--expected-db-host"),
    visibility: enumArgument(
      "--visibility",
      ["private", "unlisted", "public"] as const,
      "private",
    ),
    nsfw: booleanArgument("--nsfw"),
    contentType: enumArgument(
      "--content-type",
      ["original", "self_designed", "fanwork"] as const,
      "original",
    ),
    commit: process.argv.includes("--commit"),
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function assertCurrentRuntimeContract(
  characterName: string,
  runtimePath: string | undefined,
): Promise<void> {
  if (!runtimePath) {
    throw new Error(`${characterName} 缺少 runtimeJson，禁止迁移半成品`);
  }
  const snapshot = await readJson<{
    version?: unknown;
    quality?: { version?: unknown };
  }>(runtimePath);
  if (snapshot.version !== 3 || snapshot.quality?.version !== 1) {
    throw new Error(
      `${characterName} 的运行态快照不是最新版视觉合同；请在 Mufy 页面重新运行 scripts/export-mufy-runtime.js`,
    );
  }
}

function roleIdFromSelector(selector: string): string | null {
  if (ROLE_ID_RE.test(selector.trim())) return selector.trim();
  try {
    const roleId = new URL(selector).searchParams.get("roleId");
    return roleId && ROLE_ID_RE.test(roleId) ? roleId : null;
  } catch {
    return null;
  }
}

function findToken(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const token = findToken(entry);
      if (token) return token;
    }
    return null;
  }
  const object = value as Record<string, unknown>;
  if (typeof object.token === "string" && object.token) return object.token;
  for (const entry of Object.values(object)) {
    const token = findToken(entry);
    if (token) return token;
  }
  return null;
}

async function requestJson(input: {
  url: string;
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
}): Promise<unknown> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(input.url, {
        method: input.method ?? "GET",
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json",
          origin: MUFY_ORIGIN,
          ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = new Error(
          `Mufy API HTTP ${response.status}：${text.slice(0, 300)}`,
        );
      } else {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          lastError = new Error(`Mufy API 返回非 JSON：${text.slice(0, 300)}`);
        }
      }
    } catch (error) {
      lastError = new Error(
        `Mufy API 请求失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (attempt < 3) await Bun.sleep(attempt * 750);
  }
  throw lastError ?? new Error("Mufy API 请求失败");
}

async function fetchDetailSnapshots(
  options: Options,
  mappings: RoleMapping[],
): Promise<Map<string, string>> {
  const paths = new Map<string, string>();
  const online = mappings.filter((mapping) => !mapping.detailJson);
  let token: string | null = null;
  if (online.length) {
    const email = process.env.MUFY_EMAIL?.trim();
    const password = process.env.MUFY_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "在线批量抓取需要 MUFY_EMAIL/MUFY_PASSWORD；也可在映射中提供 detailJson",
      );
    }
    const login = await requestJson({
      url: `${MUFY_ORIGIN}/api/users/login`,
      method: "POST",
      body: { email, password },
    });
    token = findToken(login);
    if (!token) throw new Error("Mufy 登录响应中未找到 token");
  }

  for (const mapping of mappings) {
    if (mapping.detailJson) {
      paths.set(
        mapping.localName,
        resolve(options.sourceDir, mapping.detailJson),
      );
      continue;
    }
    const roleId = roleIdFromSelector(mapping.selector);
    if (!roleId) {
      throw new Error(
        `${mapping.localName} 没有明确 roleId；批量写入禁止只按名字搜索`,
      );
    }
    const detail = await requestJson({
      url: `${MUFY_ORIGIN}/api/characters/get?id=${encodeURIComponent(roleId)}`,
      token: token as string,
    });
    const path = join(
      options.reportDir,
      `${mapping.localName}-mufy-detail.json`,
    );
    await writeFile(path, `${JSON.stringify(detail, null, 2)}\n`, "utf8");
    paths.set(mapping.localName, path);
  }
  return paths;
}

function promptPathFor(
  sourceDir: string,
  record: SourceManifestRecord,
): string {
  const fromManifest = record.assembled_prompt
    ? join(sourceDir, "assembled", basename(record.assembled_prompt))
    : null;
  return resolve(
    fromManifest ??
      join(sourceDir, "assembled", `${record.character_name}_prompt.txt`),
  );
}

async function runCard(input: {
  options: Options;
  mapping: RoleMapping;
  promptPath: string;
  detailPath: string;
  runtimePath?: string;
  reportPath: string;
  commit: boolean;
}): Promise<{ ok: boolean; exitCode: number; stdout: string; stderr: string }> {
  const args = [
    "bun",
    resolve("scripts/migrate-mufy-card.ts"),
    "--role",
    input.mapping.selector,
    "--prompt-json",
    input.promptPath,
    "--detail-json",
    input.detailPath,
    "--target-name",
    input.mapping.targetName ?? input.mapping.localName,
    "--min-greeting-similarity",
    String(input.mapping.minGreetingSimilarity ?? 0.85),
    "--visibility",
    input.options.visibility,
    "--content-type",
    input.options.contentType,
    "--report",
    input.reportPath,
  ];
  if (input.runtimePath) args.push("--runtime-json", input.runtimePath);
  if (input.options.nsfw !== undefined) {
    args.push("--nsfw", String(input.options.nsfw));
  }
  if (input.commit) {
    if (!input.options.ownerEmail || !input.options.expectedDbHost) {
      throw new Error(
        "批量写库必须同时提供 --owner-email 与 --expected-db-host",
      );
    }
    args.push(
      "--commit",
      "--scope",
      "TEST",
      "--owner-email",
      input.options.ownerEmail,
      "--expected-db-host",
      input.options.expectedDbHost,
    );
  }

  const child = Bun.spawn(args, {
    cwd: resolve("."),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { ok: exitCode === 0, exitCode, stdout, stderr };
}

async function main() {
  const options = parseOptions();
  const manifest = await readJson<SourceManifest>(
    join(options.sourceDir, "manifest.json"),
  );
  const roleMap = await readJson<RoleMapFile>(options.roleMapPath);
  if (roleMap.version !== 1 || !Array.isArray(roleMap.roles)) {
    throw new Error("角色映射文件格式无效；当前只支持 version=1");
  }
  const manifestByName = new Map(
    manifest.records.map((record) => [record.character_name, record]),
  );
  const mappings = roleMap.roles.filter(
    (mapping) =>
      mapping.enabled !== false &&
      (!options.only || options.only.has(mapping.localName)),
  );
  if (!mappings.length) throw new Error("没有选中任何可迁移角色");
  if (options.only) {
    const mapped = new Set(mappings.map((mapping) => mapping.localName));
    const missing = [...options.only].filter((name) => !mapped.has(name));
    if (missing.length) {
      throw new Error(`角色映射文件缺少：${missing.join("、")}`);
    }
  }

  await mkdir(options.reportDir, { recursive: true });
  const detailPaths = await fetchDetailSnapshots(options, mappings);
  const plan = mappings.map((mapping) => {
    const record = manifestByName.get(mapping.localName);
    if (!record) {
      throw new Error(`manifest.json 中找不到 ${mapping.localName}`);
    }
    return {
      mapping,
      promptPath: promptPathFor(options.sourceDir, record),
      detailPath: detailPaths.get(mapping.localName) as string,
      runtimePath: mapping.runtimeJson
        ? resolve(options.sourceDir, mapping.runtimeJson)
        : undefined,
    };
  });
  for (const entry of plan) {
    await assertCurrentRuntimeContract(
      entry.mapping.localName,
      entry.runtimePath,
    );
  }

  const dryRuns = [];
  for (const entry of plan) {
    const result = await runCard({
      options,
      mapping: entry.mapping,
      promptPath: entry.promptPath,
      detailPath: entry.detailPath,
      runtimePath: entry.runtimePath,
      reportPath: join(
        options.reportDir,
        `${entry.mapping.localName}-dry-run.json`,
      ),
      commit: false,
    });
    dryRuns.push({ name: entry.mapping.localName, ...result });
  }
  const dryRunFailures = dryRuns.filter((result) => !result.ok);
  if (dryRunFailures.length) {
    const report = {
      version: 1,
      generatedAt: new Date().toISOString(),
      mode: "dry-run",
      ok: false,
      results: dryRuns,
    };
    await writeFile(
      join(options.reportDir, "batch-report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    throw new Error(
      `有 ${dryRunFailures.length} 张卡未通过预检：${dryRunFailures
        .map((result) => result.name)
        .join("、")}`,
    );
  }

  const commits = [];
  if (options.commit) {
    for (const entry of plan) {
      const result = await runCard({
        options,
        mapping: entry.mapping,
        promptPath: entry.promptPath,
        detailPath: entry.detailPath,
        runtimePath: entry.runtimePath,
        reportPath: join(
          options.reportDir,
          `${entry.mapping.localName}-commit.json`,
        ),
        commit: true,
      });
      commits.push({ name: entry.mapping.localName, ...result });
      if (!result.ok) break;
    }
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: options.commit ? "TEST commit" : "dry-run",
    ok:
      dryRuns.every((result) => result.ok) &&
      commits.every((result) => result.ok),
    selected: plan.map((entry) => ({
      localName: entry.mapping.localName,
      selector: entry.mapping.selector,
      targetName: entry.mapping.targetName ?? entry.mapping.localName,
      minGreetingSimilarity: entry.mapping.minGreetingSimilarity ?? 0.85,
      promptPath: entry.promptPath,
      detailPath: entry.detailPath,
      runtimePath: entry.runtimePath ?? null,
    })),
    dryRuns,
    commits,
  };
  const reportPath = join(options.reportDir, "batch-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        mode: report.mode,
        selected: report.selected.map((entry) => entry.localName),
        reportPath,
      },
      null,
      2,
    ),
  );
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
