#!/usr/bin/env bun

/**
 * Repeatable Mufy -> Dearm single-card migration pipeline.
 *
 * Dry-run (no DB write):
 *   bun run mufy:migrate --role "角色名或 Mufy URL" \
 *     --prompt-json "完整 Prompt 导出.json" \
 *     [--detail-json "已导出的角色详情.json"]
 *
 * Fetching detail directly from Mufy requires MUFY_EMAIL/MUFY_PASSWORD.
 * Committing requires DATABASE_URL, --scope TEST, --expected-db-host and
 * --owner-email. New cards are private unless --visibility is specified.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import postgres from "postgres";
import { omitUnavailableMufyAudio } from "../src/lib/import/mufy-missing-audio";
import { adaptMufyHostCss } from "../src/lib/import/mufy-host-css-adaptation";
import { sanitizeAndScopeCss } from "../src/lib/styling/whitelist";
import {
  type MufyRoleDetail,
  normalizeMufyCharacterName,
  parseMufyPromptSourceText,
  prepareMufyMigration,
  selectMufyRoleDetail,
  selectMufyRuntimeDetail,
  selectPromptRecord,
  sha256,
} from "../src/lib/import/mufy-migration";
import { uploadImageToR2 } from "../src/lib/r2/client";

type Visibility = "public" | "private" | "unlisted";
type ContentType = "original" | "self_designed" | "fanwork";

interface CliOptions {
  allowMissingImages: boolean;
  preferLocalAge: boolean;
  adaptHostCss: boolean;
  allowMissingAudio: boolean;
  role: string;
  promptJsonPath: string;
  detailJsonPath?: string;
  runtimeJsonPath?: string;
  targetName?: string;
  reportPath?: string;
  ownerEmail?: string;
  expectedDbHost?: string;
  updateCharacterId?: string;
  packId?: string;
  scope?: string;
  visibility: Visibility;
  visibilitySpecified: boolean;
  nsfw?: boolean;
  contentType: ContentType;
  minGreetingSimilarity?: number;
  commit: boolean;
}

interface CurlResponse {
  status: number;
  bodyText: string;
  json: unknown;
}

const MUFY_ORIGIN = "https://chat.mufy.ai";
const ROLE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function booleanArgument(flag: string): boolean | undefined {
  const value = argumentValue(flag);
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${flag} 只能是 true 或 false`);
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

function numberArgument(flag: string): number | undefined {
  const value = argumentValue(flag);
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${flag} 必须是 0 到 1 之间的数字`);
  }
  return parsed;
}

function parseOptions(): CliOptions {
  const role = argumentValue("--role");
  const promptJsonPath = argumentValue("--prompt-json");
  if (!role) throw new Error("缺少 --role（角色名、roleId 或 Mufy 聊天链接）");
  if (!promptJsonPath)
    throw new Error("缺少 --prompt-json（完整 Prompt 导出 JSON）");

  return {
    role,
    allowMissingAudio: process.argv.includes("--allow-missing-audio") || process.argv.includes("--allow-missing-media"),
    allowMissingImages: process.argv.includes("--allow-missing-media"),
    preferLocalAge: process.argv.includes("--use-local-age"),
    adaptHostCss: process.argv.includes("--adapt-host-css"),
    promptJsonPath: resolve(promptJsonPath),
    detailJsonPath: argumentValue("--detail-json")
      ? resolve(argumentValue("--detail-json") as string)
      : undefined,
    runtimeJsonPath: argumentValue("--runtime-json")
      ? resolve(argumentValue("--runtime-json") as string)
      : undefined,
    targetName: argumentValue("--target-name"),
    reportPath: argumentValue("--report")
      ? resolve(argumentValue("--report") as string)
      : undefined,
    ownerEmail: argumentValue("--owner-email"),
    expectedDbHost: argumentValue("--expected-db-host"),
    updateCharacterId: argumentValue("--update-character-id"),
    packId: argumentValue("--pack-id"),
    scope: argumentValue("--scope"),
    visibility: enumArgument(
      "--visibility",
      ["private", "unlisted", "public"] as const,
      "private",
    ),
    visibilitySpecified: argumentValue("--visibility") !== undefined,
    nsfw: booleanArgument("--nsfw"),
    contentType: enumArgument(
      "--content-type",
      ["original", "self_designed", "fanwork"] as const,
      "original",
    ),
    minGreetingSimilarity: numberArgument("--min-greeting-similarity"),
    commit: process.argv.includes("--commit"),
  };
}

function redactDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

function safeSegment(value: string): string {
  const safe = value
    .replace(/[^\w一-鿿.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 48);
  return safe || "character";
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

function roleIdFromSelector(selector: string): string | null {
  if (ROLE_ID_RE.test(selector.trim())) return selector.trim();
  try {
    const url = new URL(selector);
    const roleId = url.searchParams.get("roleId");
    return roleId && ROLE_ID_RE.test(roleId) ? roleId : null;
  } catch {
    return null;
  }
}

async function curlJson(input: {
  url: string;
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
}): Promise<CurlResponse> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(input.url, {
        method: input.method ?? "GET",
        redirect: "follow",
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json",
          origin: MUFY_ORIGIN,
          ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: AbortSignal.timeout(60_000),
      });
      const bodyText = await response.text();
      try {
        const json = JSON.parse(bodyText) as unknown;
        if (response.ok) {
          return { status: response.status, bodyText, json };
        }
        lastError = new Error(
          `Mufy API HTTP ${response.status}：${bodyText.slice(0, 500)}`,
        );
      } catch {
        lastError = new Error(
          `Mufy API HTTP ${response.status} 返回非 JSON：${bodyText.slice(0, 500)}`,
        );
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

function collectSearchCandidates(value: unknown, depth = 0): MufyRoleDetail[] {
  if (depth > 5 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectSearchCandidates(entry, depth + 1));
  }
  const object = value as Record<string, unknown>;
  const candidateId =
    typeof object.characterId === "string"
      ? object.characterId
      : typeof object.roleId === "string"
        ? object.roleId
        : typeof object.id === "string"
          ? object.id
          : null;
  const candidateName =
    typeof object.name === "string"
      ? object.name
      : typeof object.characterName === "string"
        ? object.characterName
        : null;
  const current =
    candidateId && candidateName
      ? ([
          { ...object, characterId: candidateId, name: candidateName },
        ] as unknown as MufyRoleDetail[])
      : [];
  return [
    ...current,
    ...Object.values(object).flatMap((entry) =>
      collectSearchCandidates(entry, depth + 1),
    ),
  ];
}

async function fetchDetailFromMufy(selector: string): Promise<{
  detail: MufyRoleDetail;
  rawResponse: unknown;
}> {
  const email = process.env.MUFY_EMAIL?.trim();
  const password = process.env.MUFY_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "未提供 --detail-json 时，必须设置 MUFY_EMAIL 与 MUFY_PASSWORD 环境变量",
    );
  }
  const login = await curlJson({
    url: `${MUFY_ORIGIN}/api/users/login`,
    method: "POST",
    body: { email, password },
  });
  const token = findToken(login.json);
  if (!token) throw new Error("Mufy 登录成功响应中未找到 token");

  let roleId = roleIdFromSelector(selector);
  if (!roleId) {
    const search = await curlJson({
      url: `${MUFY_ORIGIN}/api/characters/query`,
      method: "POST",
      token,
      body: {
        pageNum: 1,
        pageSize: 50,
        sortBy: "all",
        genderText: "全性别",
        tags: [],
        showNsfw: true,
        search: selector,
        excludeIds: [],
      },
    });
    const candidates = [
      ...new Map(
        collectSearchCandidates(search.json).map((item) => [
          item.characterId,
          item,
        ]),
      ).values(),
    ];
    const exact = candidates.filter(
      (item) => item.name.trim() === selector.trim(),
    );
    const normalized = candidates.filter(
      (item) =>
        normalizeMufyCharacterName(item.name) ===
        normalizeMufyCharacterName(selector),
    );
    const match =
      exact.length === 1
        ? exact[0]
        : normalized.length === 1
          ? normalized[0]
          : null;
    if (!match) {
      throw new Error(
        `Mufy 搜索无法唯一确定“${selector}”：${
          candidates
            .map((item) => `${item.name}(${item.characterId})`)
            .join("、") || "无结果"
        }`,
      );
    }
    roleId = match.characterId;
  }

  const response = await curlJson({
    url: `${MUFY_ORIGIN}/api/characters/get?id=${encodeURIComponent(roleId)}`,
    token,
  });
  return {
    detail: selectMufyRoleDetail(response.json, roleId),
    rawResponse: response.json,
  };
}

function assertCommitGuards(options: CliOptions, databaseUrl: string): void {
  if (options.scope !== "TEST") {
    throw new Error("数据库写入只允许测试环境，必须显式传 --scope TEST");
  }
  if (!options.ownerEmail) throw new Error("数据库写入必须传 --owner-email");
  if (!options.expectedDbHost) {
    throw new Error("数据库写入必须传 --expected-db-host，用于阻止误连正式库");
  }
  let actualHost: string;
  try {
    actualHost = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("DATABASE_URL 不是可解析的 URL");
  }
  if (actualHost.toLowerCase() !== options.expectedDbHost.toLowerCase()) {
    throw new Error(
      `数据库主机保护失败：实际 ${actualHost}，预期 ${options.expectedDbHost}`,
    );
  }
  if (options.packId && !options.updateCharacterId) {
    throw new Error("--pack-id 只能与 --update-character-id 一起使用");
  }
}

async function persistMigration(input: {
  options: CliOptions;
  prepared: ReturnType<typeof prepareMufyMigration>;
  promptSourceText: string;
  detailSourceText: string;
  runtimeSourceText: string;
  runtimeSnapshot: RuntimeSnapshot;
}) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("数据库写入需要 DATABASE_URL");
  assertCommitGuards(input.options, databaseUrl);
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const owners = await sql<Array<{ id: string; email: string }>>`
      select id,email from users where lower(email)=lower(${input.options.ownerEmail as string})
    `;
    if (owners.length !== 1) {
      throw new Error(
        `owner ${input.options.ownerEmail} 必须唯一存在，实际 ${owners.length} 条`,
      );
    }
    const owner = owners[0];
    const card = input.prepared.character;
    const visual = input.prepared.beautification;
    await localizeRuntimeAssets({
      runtime: input.runtimeSnapshot,
      roleId: input.prepared.roleId,
      ownerId: owner.id,
      card,
      visual,
      prepared: input.prepared,
      allowMissingMedia: input.options.allowMissingImages,
    });

    const renderMarkers = [
      ...(input.prepared.issues.some(issue => issue.code === "AUTOMATIC_RUNTIME_ADAPTATION" && issue.message === "sandbox-cloud-player") ? ["<云朵播放器>"] : []),
      ...(input.prepared.issues.some(issue => issue.code === "AUTOMATIC_RUNTIME_ADAPTATION" && issue.message === "source-item-actions-to-composer") ? ["<定制指令组件正则>"] : []),
    ];
    const markerRuleName = "Mufy 已适配组件标记";
    const renderedRuleName = "Mufy 来源开场渲染合同";
    if (visual.openingRender) visual.openingRender.pattern = "^(?:" + visual.openingRender.pattern + "|" + card.opening.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")$";
    const writeOpeningRender = async (tx: postgres.TransactionSql, packId: string) => {
      await tx`delete from regex_rules where pack_id=${packId} and name=${renderedRuleName}`;
      if (visual.openingRender) await tx`insert into regex_rules(pack_id,name,pattern,replacement,enabled,visible,order_index) values(${packId},${renderedRuleName},${visual.openingRender.pattern},${visual.openingRender.replacement},true,false,-100)`;
      const replyRuleName = "Mufy 参数化后续回复协议";
      await tx`delete from regex_rules where pack_id=${packId} and name=${replyRuleName}`;
      if (visual.replyRender) await tx`insert into regex_rules(pack_id,name,pattern,replacement,enabled,visible,order_index) values(${packId},${replyRuleName},${visual.replyRender.pattern},${visual.replyRender.replacement},true,false,${visual.replyRender.orderIndex})`;
    };
    const result = await sql.begin(async (tx) => {
      if (!input.options.updateCharacterId) {
        const duplicates = await tx<Array<{ id: string }>>`
          select id from characters where owner_id=${owner.id} and name=${card.name}
        `;
        if (duplicates.length) {
          throw new Error(
            `测试账号已存在同名角色 ${card.name}（${duplicates.map((row) => row.id).join(", ")}）；如需迭代请传 --update-character-id`,
          );
        }
        const [character] = await tx<Array<{ id: string }>>`
          insert into characters(
            owner_id,name,gender,age,nsfw,is_ai,content_type,cover_image_url,
            avatar_url,tags,bio,creator_note,visibility,persona,adversity,
            default_cognition,opening,plot_setting,output_setting,sample_dialogue
          ) values (
            ${owner.id},${card.name},${card.gender},${card.age},${card.nsfw},
            ${card.isAi},${card.contentType},${card.coverImageUrl},${card.avatarUrl},
            ${tx.json(card.tags)},${card.bio},${card.creatorNote},${input.options.visibility},
            ${card.persona},${card.adversity},${card.defaultCognition},${card.opening},
            ${card.plotSetting},${card.outputSetting},${card.sampleDialogue}
          ) returning id
        `;
        const [pack] = await tx<Array<{ id: string }>>`
          insert into beautification_packs(owner_user_id,name,description,global_css,is_public)
          values(
            ${owner.id},${`${card.name} 的美化包`},
            ${`Mufy 原始迁移；sourceRoleId=${input.prepared.roleId}`},
            ${visual.globalCss},false
          ) returning id
        `;
        await tx`
          insert into character_pack_subscriptions(character_id,pack_id,order_index,css_enabled,opening_enabled)
          values(${character.id},${pack.id},0,true,true)
        `;
        if (visual.openingComponent) {
          await tx`
            insert into opening_components(pack_id,name,content,enabled,order_index)
            values(${pack.id},${visual.openingComponentName},${visual.openingComponent},true,0)
          `;
        }
        await writeOpeningRender(tx, pack.id);
        if(renderMarkers.length) await tx`insert into regex_rules(pack_id,name,pattern,replacement,enabled,visible,order_index) values(${pack.id},${markerRuleName},${renderMarkers.join("|")},${""},true,false,0)`;
        return {
          mode: "create" as const,
          characterId: character.id,
          packId: pack.id,
        };
      }

      const rows = await tx<
        Array<{
          id: string;
          name: string;
          owner_id: string;
          visibility: Visibility;
        }>
      >`
        select id,name,owner_id,visibility from characters
        where id=${input.options.updateCharacterId}
      `;
      if (rows.length !== 1)
        throw new Error("--update-character-id 对应角色不存在");
      const existing = rows[0];
      if (existing.owner_id !== owner.id)
        throw new Error("更新目标不属于 --owner-email");
      if (
        normalizeMufyCharacterName(existing.name) !==
        normalizeMufyCharacterName(card.name)
      ) {
        throw new Error(
          `更新目标名称 ${existing.name} 与迁移角色 ${card.name} 不一致`,
        );
      }

      const packs = input.options.packId
        ? await tx<Array<{ id: string }>>`
            select p.id from beautification_packs p
            join character_pack_subscriptions s on s.pack_id=p.id
            where p.id=${input.options.packId} and p.owner_user_id=${owner.id}
              and s.character_id=${existing.id}
          `
        : await tx<Array<{ id: string }>>`
            select p.id from beautification_packs p
            join character_pack_subscriptions s on s.pack_id=p.id
            where p.owner_user_id=${owner.id} and s.character_id=${existing.id}
            order by s.order_index
          `;
      if (packs.length !== 1) {
        throw new Error(
          `更新目标必须能唯一确定一个自有美化包，实际 ${packs.length} 个；请传 --pack-id`,
        );
      }
      const packId = packs[0].id;
      await tx`
        update characters set
          name=${card.name},gender=${card.gender},age=${card.age},nsfw=${card.nsfw},
          is_ai=${card.isAi},content_type=${card.contentType},
          cover_image_url=${card.coverImageUrl},avatar_url=${card.avatarUrl},
          tags=${tx.json(card.tags)},bio=${card.bio},creator_note=${card.creatorNote},
          visibility=${input.options.visibilitySpecified ? input.options.visibility : existing.visibility},
          persona=${card.persona},adversity=${card.adversity},
          default_cognition=${card.defaultCognition},opening=${card.opening},
          plot_setting=${card.plotSetting},output_setting=${card.outputSetting},
          sample_dialogue=${card.sampleDialogue},updated_at=now()
        where id=${existing.id}
      `;
      await tx`
        update beautification_packs set global_css=${visual.globalCss},
          description=${`Mufy 原始迁移；sourceRoleId=${input.prepared.roleId}`},updated_at=now()
        where id=${packId}
      `;
      // Preserve unrelated components the creator may have added after the
      // first migration; only replace the component owned by this pipeline.
      await tx`
        delete from opening_components
        where pack_id=${packId} and (name=${visual.openingComponentName}
          or name=${Buffer.from(visual.openingComponentName,"utf8").toString("latin1")})
      `;
      if (visual.openingComponent) {
        await tx`
          insert into opening_components(pack_id,name,content,enabled,order_index)
          values(${packId},${visual.openingComponentName},${visual.openingComponent},true,0)
        `;
      }
      // Re-render old sessions without rewriting any user or historical messages.
      await tx`delete from regex_rules where pack_id=${packId} and name=${markerRuleName}`;
      await writeOpeningRender(tx, packId);
      if(renderMarkers.length) await tx`insert into regex_rules(pack_id,name,pattern,replacement,enabled,visible,order_index) values(${packId},${markerRuleName},${renderMarkers.join("|")},${""},true,false,0)`;
      return { mode: "update" as const, characterId: existing.id, packId };
    });

    const backupDir = resolve(
      process.env.IMPORT_BACKUP_DIR?.trim() || "data/card-imports",
      `${safeSegment(input.prepared.targetName)}-${result.characterId.slice(0, 8)}`,
      `mufy-${timestamp()}`,
    );
    let backupError: string | null = null;
    try {
      await mkdir(backupDir, { recursive: true });
      await Promise.all([
        writeFile(
          join(backupDir, "prompt-export.json"),
          input.promptSourceText,
          "utf8",
        ),
        writeFile(
          join(backupDir, "mufy-detail.json"),
          input.detailSourceText,
          "utf8",
        ),
        writeFile(
          join(backupDir, "mufy-runtime.json"),
          input.runtimeSourceText,
          "utf8",
        ),
        writeFile(
          join(backupDir, "source-manifest.json"),
          `${JSON.stringify(
            {
              importedAt: new Date().toISOString(),
              environment: "TEST",
              ownerEmail: owner.email,
              sourceRoleId: input.prepared.roleId,
              sourceName: input.prepared.sourceName,
              targetName: input.prepared.targetName,
              characterId: result.characterId,
              packId: result.packId,
              promptSha256: sha256(input.promptSourceText),
              detailSha256: sha256(input.detailSourceText),
              runtimeSha256: sha256(input.runtimeSourceText),
            },
            null,
            2,
          )}\n`,
          "utf8",
        ),
      ]);
    } catch (error) {
      // The DB transaction already committed. Never report the import itself
      // as failed and tempt an operator into creating a duplicate card.
      backupError = error instanceof Error ? error.message : String(error);
      console.error("[mufy-migrate] source backup failed", backupError);
    }
    return {
      ...result,
      backupDir: backupError ? null : backupDir,
      backupError,
      database: redactDatabaseUrl(databaseUrl),
    };
  } finally {
    await sql.end();
  }
}

interface RuntimeAsset {
  url?: unknown;
  ok?: unknown;
  contentType?: unknown;
  dataUrl?: unknown;
}

interface RuntimeSnapshot {
  version: number;
  characterId: string;
  characterName?: string;
  viewport?: { width?: unknown; height?: unknown };
  runtimeNodes?: unknown[];
  assets: RuntimeAsset[];
  quality?: { version?: unknown };
}

interface RuntimeNode {
  id?: unknown;
  className?: unknown;
  outerHTML?: unknown;
}

const RUNTIME_TAG_PATTERNS = {
  侧边栏指令区:
    /(?:sidebar|emoticon-sidebar|injected-ghost-sidebar-root|censy-blue-glass-sidebar)/i,
  侧边栏播放器: /(?:player|island-container|ft-ghost-sidebar|audio)/i,
} as const;

function runtimeSnapshotText(runtime: RuntimeSnapshot): string {
  return (runtime.runtimeNodes ?? [])
    .map((value) => {
      if (!value || typeof value !== "object") return "";
      const node = value as RuntimeNode;
      return [node.id, node.className, node.outerHTML]
        .filter((part): part is string => typeof part === "string")
        .join("\n");
    })
    .join("\n");
}

function validateRuntimeSnapshot(
  prepared: ReturnType<typeof prepareMufyMigration>,
  runtime: RuntimeSnapshot,
): void {
  const runtimeText = runtimeSnapshotText(runtime);

  for (const marker of prepared.audit.runtimeMarkers) {
    if (!marker.presentInPrompt || marker.implementationFoundInDetail) continue;
    const pattern =
      RUNTIME_TAG_PATTERNS[marker.tag as keyof typeof RUNTIME_TAG_PATTERNS];
    if (pattern?.test(runtimeText)) {
      const needle = `<${marker.tag}>`;
      prepared.issues = prepared.issues.filter(
        (issue) =>
          !(
            issue.code === "RUNTIME_COMPONENT_NOT_EXPORTED" &&
            issue.message.includes(needle)
          ),
      );
      prepared.issues.push({
        level: "info",
        code: "RUNTIME_COMPONENT_CAPTURED",
        message: `${needle} 未出现在详情源码，但已在 Mufy 运行态快照中捕获`,
      });
    }
  }

  const visualSource = [
    prepared.beautification.globalCss ?? "",
    prepared.beautification.openingComponent ?? "",
    prepared.character.opening,
  ].join("\n");
  const failedReferencedAssets = runtime.assets.filter(
    (asset): asset is RuntimeAsset & { url: string } =>
      typeof asset.url === "string" &&
      visualSource.includes(asset.url) &&
      /\.(?:avif|webp|png|jpe?g|gif|svg|mp3|m4a|wav|ogg)(?:\?|$)/i.test(
        asset.url,
      ) &&
      !(asset.ok === true && typeof asset.dataUrl === "string"),
  );
  for (const asset of failedReferencedAssets) {
    prepared.issues.push({
      level: "error",
      code: "RUNTIME_REFERENCED_ASSET_NOT_EMBEDDED",
      message: `美化引用资源未成功内嵌，禁止保留可能失效的外链：${asset.url}`,
    });
  }

  if (prepared.audit.cssWarningCount > 0) {
    prepared.issues.push({
      level: "error",
      code: "GLOBAL_CSS_REQUIRES_ADAPTATION",
      message: `原卡全局 CSS 有 ${prepared.audit.cssWarningCount} 条规则无法直接通过寄情安全作用域；必须先完成等价适配，不能按残缺美化写库`,
    });
  }

  if (runtime.version >= 3 && runtime.quality?.version !== 1) {
    prepared.issues.push({
      level: "error",
      code: "RUNTIME_VISUAL_CONTRACT_MISSING",
      message:
        "最新版运行态快照缺少视觉验收合同；无法自动检查气泡、输入框、思考动效与悬浮组件",
    });
  }
  if (runtime.version === 2) {
    prepared.issues.push({
      level: "warning",
      code: "RUNTIME_SNAPSHOT_LEGACY",
      message:
        "这是旧版 version=2 快照，只允许历史重放；新迁移必须用最新版导出器生成 version=3 视觉合同",
    });
  }
}

function parseRuntimeSnapshot(
  sourceText: string,
  expectedRoleId: string,
): RuntimeSnapshot {
  const value = JSON.parse(sourceText) as Partial<RuntimeSnapshot>;
  if (value.version !== 2 && value.version !== 3) {
    throw new Error(
      "运行态快照格式无效：必须由 export-mufy-runtime.js version=2/3 导出",
    );
  }
  if (value.characterId !== expectedRoleId) {
    throw new Error(
      `运行态角色不匹配：期望 ${expectedRoleId}，实际 ${String(value.characterId)}`,
    );
  }
  if (!Array.isArray(value.assets)) {
    throw new Error("运行态快照缺少 assets 数组");
  }
  return value as RuntimeSnapshot;
}

function embeddedAsset(runtime: RuntimeSnapshot, url: string | null) {
  if (!url) return null;
  return runtime.assets.find(
    (asset) =>
      asset.url === url &&
      asset.ok === true &&
      typeof asset.dataUrl === "string",
  );
}

function decodeDataUrl(value: string): {
  body: Uint8Array;
  contentType: string;
} {
  if (!value.startsWith("data:")) {
    throw new Error("运行态资源不是有效 data URL");
  }
  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) throw new Error("运行态资源不是有效 data URL");
  const metadata = value.slice(5, commaIndex);
  const payload = value.slice(commaIndex + 1);
  const parts = metadata.split(";").map((part) => part.trim());
  const contentType = parts[0] || "application/octet-stream";
  const isBase64 = parts
    .slice(1)
    .some((part) => part.toLowerCase() === "base64");
  const body = isBase64
    ? Uint8Array.from(Buffer.from(payload, "base64"))
    : new TextEncoder().encode(decodeURIComponent(payload));
  return { body, contentType };
}

function extensionFor(contentType: string): string {
  const known: Record<string, string> = {
    "image/avif": "avif",
    "image/webp": "webp",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
  };
  return known[contentType.toLowerCase()] ?? "bin";
}

async function localizeRuntimeAssets(input: {
  prepared: ReturnType<typeof prepareMufyMigration>;
  allowMissingMedia: boolean;
  runtime: RuntimeSnapshot;
  roleId: string;
  ownerId: string;
  card: ReturnType<typeof prepareMufyMigration>["character"];
  visual: ReturnType<typeof prepareMufyMigration>["beautification"];
}) {
  const serialized = JSON.stringify({ card: input.card, visual: input.visual });
  const candidates = input.runtime.assets.filter(
    (asset): asset is RuntimeAsset & { url: string; dataUrl: string } =>
      typeof asset.url === "string" &&
      typeof asset.dataUrl === "string" &&
      asset.ok === true &&
      (serialized.includes(asset.url) ||
        asset.url === input.card.avatarUrl ||
        asset.url === input.card.coverImageUrl),
  );
  const replacements = new Map<string, string>();
  for (const asset of candidates) {
    const decoded = decodeDataUrl(asset.dataUrl);
    const key = `characters/${input.ownerId}/mufy/${input.roleId}/${sha256(asset.url).slice(0, 20)}.${extensionFor(decoded.contentType)}`;
    try {
      const uploaded = await uploadImageToR2({ key, body: decoded.body, contentType: decoded.contentType, upsert: true });
      replacements.set(asset.url, uploaded.publicUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!input.allowMissingMedia || !/maximum allowed size|exceeded.*size|mime type.*not supported/i.test(message)) throw error;
      const omitted = omitUnavailableMufyAudio(input.prepared, [{url:asset.url,ok:false,contentType:decoded.contentType}], true, true);
      if (!omitted.length && /\.(?:ttf|otf|woff2?)(?:\?|$)/i.test(asset.url)) {
        input.card.opening = input.card.opening.split(asset.url).join("");
        if(input.visual.openingComponent) input.visual.openingComponent=input.visual.openingComponent.split(asset.url).join("");
        if(input.visual.globalCss) input.visual.globalCss=input.visual.globalCss.split(asset.url).join("");
      } else if (!omitted.length) throw error;
      input.prepared.issues.push({level:"warning",code:"VISUAL_ASSET_UPLOAD_DEFERRED",message:`媒体/字体上传受存储上限限制，列入后补清单：${asset.url}；${message}`});
    }
  }
  const rewrite = (value: string | null): string | null => {
    if (!value) return value;
    let next = value;
    for (const [from, to] of replacements) next = next.replaceAll(from, to);
    return next;
  };
  input.card.avatarUrl = rewrite(input.card.avatarUrl);
  if (input.visual.openingRender) input.visual.openingRender.replacement = rewrite(input.visual.openingRender.replacement) ?? input.visual.openingRender.replacement;
  if (input.visual.replyRender) input.visual.replyRender.replacement = rewrite(input.visual.replyRender.replacement) ?? input.visual.replyRender.replacement;
  input.card.coverImageUrl = rewrite(input.card.coverImageUrl);
  input.card.opening = rewrite(input.card.opening) ?? input.card.opening;
  input.card.persona = rewrite(input.card.persona) ?? input.card.persona;
  input.card.adversity = rewrite(input.card.adversity);
  input.card.defaultCognition = rewrite(input.card.defaultCognition);
  input.card.plotSetting = rewrite(input.card.plotSetting);
  input.card.outputSetting = rewrite(input.card.outputSetting);
  input.card.sampleDialogue = rewrite(input.card.sampleDialogue);
  input.visual.globalCss = rewrite(input.visual.globalCss);
  input.visual.openingComponent = rewrite(input.visual.openingComponent);
}

async function main() {
  const options = parseOptions();
  const promptSourceText = await readFile(options.promptJsonPath, "utf8");
  const promptSource = parseMufyPromptSourceText(promptSourceText);
  const runtimeSourceText = options.runtimeJsonPath
    ? await readFile(options.runtimeJsonPath, "utf8")
    : "";
  const runtimeSourceValue = runtimeSourceText
    ? (JSON.parse(runtimeSourceText) as unknown)
    : null;

  let detail: MufyRoleDetail;
  let detailSource: unknown;
  let detailSourceKind: "file" | "mufy-api" | "authenticated-browser";
  if (options.detailJsonPath) {
    const text = await readFile(options.detailJsonPath, "utf8");
    detailSource = JSON.parse(text) as unknown;
    detail = selectMufyRoleDetail(
      detailSource,
      roleIdFromSelector(options.role) ?? options.role,
    );
    detailSourceKind = "file";
  } else if (runtimeSourceValue) {
    const runtimeDetail = selectMufyRuntimeDetail(
      runtimeSourceValue,
      roleIdFromSelector(options.role) ?? options.role,
    );
    if (!runtimeDetail) {
      throw new Error(
        "运行态快照不含已登录浏览器抓取的角色详情；请用最新版 export-mufy-runtime.js 重新导出",
      );
    }
    detail = runtimeDetail.detail;
    detailSource = runtimeDetail.rawResponse;
    detailSourceKind = "authenticated-browser";
  } else {
    const fetched = await fetchDetailFromMufy(options.role);
    detail = fetched.detail;
    detailSource = fetched.rawResponse;
    detailSourceKind = "mufy-api";
  }
  const detailSourceText = `${JSON.stringify(detailSource, null, 2)}\n`;
  const promptRecord = selectPromptRecord(promptSource, detail.name);
  const prepared = prepareMufyMigration({
    adaptRuntime: options.adaptHostCss,
    preferLocalAge: options.preferLocalAge,
    detail,
    promptRecord,
    targetName: options.targetName,
    nsfw: options.nsfw,
    contentType: options.contentType,
  });
  if (options.adaptHostCss && prepared.beautification.globalCss) {
    const adapted = adaptMufyHostCss(prepared.beautification.globalCss, [prepared.character.opening, prepared.character.outputSetting ?? ""]);
    prepared.beautification.globalCss = adapted.css || null;
    const checkedCss = sanitizeAndScopeCss(adapted.css, `audit-${prepared.roleId}`);
    prepared.audit.cssWarningCount = checkedCss.warnings.length;
    prepared.audit.cssWarnings = checkedCss.warnings;
    prepared.audit.globalCssLength = adapted.css.length;
    prepared.audit.sanitizedCssLength = checkedCss.css.length;
    if (adapted.deferred.length) prepared.issues.push({level:"warning",code:"NONPORTABLE_HOST_DECORATION_DEFERRED",
      message: JSON.stringify({ deferredRules: adapted.deferred, count: adapted.deferred.length, originalSnapshotPreserved: true })});
  }
  let runtimeSnapshot: RuntimeSnapshot | null = null;
  if (runtimeSourceText) {
    runtimeSnapshot = parseRuntimeSnapshot(runtimeSourceText, prepared.roleId);
    omitUnavailableMufyAudio(
      prepared,
      runtimeSnapshot.assets,
      options.allowMissingAudio,
      options.allowMissingImages,
    );
    validateRuntimeSnapshot(prepared, runtimeSnapshot);
    for (const [label, url] of [
      ["头像", prepared.character.avatarUrl],
      ["背景", prepared.character.coverImageUrl],
    ] as const) {
      if (url && !embeddedAsset(runtimeSnapshot, url)) {
        prepared.issues.push({
          level: "error",
          code: "RUNTIME_MEDIA_NOT_EMBEDDED",
          message: `${label}资源没有成功内嵌到运行态快照，禁止保留易失效的 Mufy 热链：${url}`,
        });
      }
    }
  } else {
    prepared.issues.push({
      level: "error",
      code: "RUNTIME_SNAPSHOT_REQUIRED",
      message: "缺少 --runtime-json；详情接口不包含完整运行态美化与可迁移媒体",
    });
  }
  if (
    options.minGreetingSimilarity !== undefined &&
    prepared.audit.greetingTextSimilarity !== null &&
    prepared.audit.greetingTextSimilarity < options.minGreetingSimilarity
  ) {
    prepared.issues.push({
      level: "error",
      code: "GREETING_TEXT_MISMATCH",
      message: `线上开场白与 Prompt 正文相似度 ${prepared.audit.greetingTextSimilarity.toFixed(4)}，低于门槛 ${options.minGreetingSimilarity.toFixed(4)}`,
    });
  }

  const blockingIssues = prepared.issues.filter(
    (issue) => issue.level === "error",
  );
  if (options.commit && blockingIssues.length) {
    throw new Error(
      `存在 ${blockingIssues.length} 个阻断问题，拒绝写库：${blockingIssues
        .map((issue) => issue.message)
        .join("；")}`,
    );
  }
  const writeResult = options.commit
    ? await persistMigration({
        options,
        prepared,
        promptSourceText,
        detailSourceText,
        runtimeSourceText,
        runtimeSnapshot: runtimeSnapshot as RuntimeSnapshot,
      })
    : null;

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: options.commit ? "commit" : "dry-run",
    scope: options.commit ? "TEST ONLY" : "NO DATABASE WRITE",
    source: {
      roleSelector: options.role,
      detailSourceKind,
      detailJsonPath: options.detailJsonPath ?? null,
      runtimeJsonPath: options.runtimeJsonPath ?? null,
      promptJsonPath: options.promptJsonPath,
      promptFileSha256: sha256(promptSourceText),
      detailSnapshotSha256: sha256(detailSourceText),
      runtimeSnapshotSha256: runtimeSourceText
        ? sha256(runtimeSourceText)
        : null,
      runtimeSnapshotVersion: runtimeSnapshot?.version ?? null,
    },
    mappingPolicy: {
      age: options.preferLocalAge ? "authorized-local-baseline" : "source-metadata",
      hostCss: options.adaptHostCss ? "safe-equivalent-reply-scope-with-explicit-deferred-decoration-ledger" : "strict-original",
      missingAudio: options.allowMissingAudio
        ? "omit-unavailable-audio-with-explicit-user-approval"
        : "strict",
      content:
        "Prompt 七段映射到寄情七个 LLM 字段；线上 greeting 优先作为实际开场白",
      visuals:
        "optimizationCode 映射全局 CSS；codeRenderContent 保持在沙箱演绎组件；运行态资源落到寄情存储",
      missingData: "只报告，不补写、不把开场白冒充小剧场",
      visibility: options.visibility,
    },
    visualAcceptance: {
      sourceContractCaptured: runtimeSnapshot?.quality?.version === 1,
      postMigrationVerificationRequired: true,
      status: options.commit ? "pending-browser-verification" : "not-run",
      command:
        "bun run mufy:verify -- --source <mufy-runtime.json> --target <dearm-runtime.json>",
    },
    prepared,
    databaseWrite: writeResult,
  };

  const reportPath =
    options.reportPath ??
    resolve(
      "logs/card-imports",
      `mufy-${safeSegment(prepared.targetName)}-${timestamp()}`,
      "migration-report.json",
    );
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: blockingIssues.length === 0,
        mode: report.mode,
        role: {
          sourceName: prepared.sourceName,
          targetName: prepared.targetName,
          roleId: prepared.roleId,
        },
        fields: prepared.audit.sectionLengths,
        greetingTextSimilarity: prepared.audit.greetingTextSimilarity,
        visuals: {
          optimizationCodeLength: prepared.audit.optimizationCodeLength,
          codeRenderContentLength: prepared.audit.codeRenderContentLength,
          globalCssLength: prepared.audit.globalCssLength,
          floatingComponentCount: prepared.audit.floatingComponentCount,
        },
        visualAcceptance: report.visualAcceptance,
        issues: prepared.issues,
        databaseWrite: writeResult,
        reportPath,
      },
      null,
      2,
    ),
  );
  if (blockingIssues.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
