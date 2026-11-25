#!/usr/bin/env bun

/**
 * Restore the original visual payloads for the six selected Mufy cards.
 *
 * Source of truth:
 *   mufy-six-role-details.json, exported by the card owner from the live
 *   authenticated Mufy character-detail endpoint.
 *
 * Mapping (matching Mufy's own web runtime):
 *   - greeting -> characters.opening
 *   - optimizationCode + codeRenderContent -> one opening component
 *   - CSS inside optimizationCode -> beautification_packs.global_css
 *   - avatarUrl/backgroundUrl -> character avatar/cover
 *
 * The source theater HTML is not redesigned. The only global-CSS adaptation
 * is the platform selector rename `mufy_` -> `nj_`; Dearm's runtime safety
 * scoper remains the final enforcement layer.
 *
 * Default is dry-run. Writing requires both `--commit` and `--scope TEST`.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { convertLegacyCss } from "../src/lib/import/external-card";
import { routeOpeningContentSplit } from "../src/lib/opening/content";
import { sanitizeAndScopeCss } from "../src/lib/styling/whitelist";

const OWNER_EMAIL = "test@test.com";

const TARGET_IDS = {
  陆永琛: "252e1466-9dcd-48cb-a580-dc97c9df85fb",
  沈知衡: "8143f91a-15d1-40a6-8a41-5b7f31f9dedf",
  闵熙彻: "5f1599a2-f379-4071-bf81-6b4c0450c1a9",
  公仪晢: "8c0c0995-b9b1-4fe2-a78c-cfe3bfeae8a4",
  喻承砚: "8667c339-beff-4478-bb9b-a707cc96fb16",
  赵漳平: "b6244940-5822-4f22-a256-c956828c8dd2",
} as const;

type CardName = keyof typeof TARGET_IDS;

const ROLE_IDS: Record<CardName, string> = {
  沈知衡: "3edce9c0-a422-412e-bcbf-7e4cb99e0c66",
  公仪晢: "1182d6d9-3a0b-4318-b000-f40c6431be81",
  赵漳平: "6ac18a00-4d93-4ecf-a66a-714ebfbe6edb",
  喻承砚: "14ead055-aea5-4687-ba5f-98ee14bbbf9d",
  闵熙彻: "d13f0069-b6bb-44fa-bf40-a74a1e798573",
  陆永琛: "31dcb981-7ca3-4091-b4ad-7a0554562029",
};

interface MufyRoleDetail {
  characterId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  tags?: string[] | null;
  age?: number | null;
  gender?: number | null;
  creatorDescriptionTitle?: string | null;
  creatorDescription?: string | null;
  greeting?: string | null;
  codeRenderContent?: string | null;
  optimizationCode?: string | null;
}

interface ExportedCard {
  roleId: string;
  status: number;
  ok: boolean;
  body?: {
    code?: number;
    reason?: string;
    data?: MufyRoleDetail;
    error?: string;
    message?: string;
  };
}

interface ExportPayload {
  exportedAt?: string;
  source?: string;
  scope?: string;
  includesSessionData?: boolean;
  cards?: Record<string, ExportedCard>;
}

interface PreparedCard {
  name: CardName;
  roleId: string;
  sourceName: string;
  age: number | null;
  tags: string[];
  bio: string | null;
  creatorNote: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  opening: string;
  originalOptimizationCode: string;
  originalCodeRenderContent: string;
  theater: string;
  globalCss: string | null;
  convertedSelectorCount: number;
  sanitizedCssLength: number;
  cssWarningCount: number;
  theaterRoute: string;
  theaterIframeCount: number;
  floatingCount: number;
}

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeName(sourceName: string): CardName | null {
  if (sourceName.startsWith("赵漳平")) return "赵漳平";
  return sourceName in TARGET_IDS ? (sourceName as CardName) : null;
}

function composeCreatorNote(detail: MufyRoleDetail): string | null {
  const parts = [
    detail.creatorDescriptionTitle?.trim(),
    detail.creatorDescription?.trim(),
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join("\n") : null;
}

function extractStyleBlocks(value: string): string[] {
  return [...value.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (match) => match[1].trim(),
  );
}

function extractGlobalCss(
  optimizationCode: string,
  codeRenderContent: string,
  roleId: string,
): string | null {
  const matches = [
    ...optimizationCode.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
  ];
  const outsideStyles = optimizationCode
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .trim();

  if (outsideStyles) {
    throw new Error(
      "optimizationCode contains non-style content; refusing a lossy global-CSS conversion",
    );
  }
  if (optimizationCode.trim() && matches.length === 0) {
    throw new Error(
      "optimizationCode is non-empty but contains no complete <style> block",
    );
  }

  const cssBlocks = [
    ...matches.map((match) => match[1].trim()),
    ...extractStyleBlocks(codeRenderContent),
  ];
  // 陆永琛的源内容用内联样式表达左对齐，但 Dearm 的消息排版默认会把
  // details/summary 居中。这里只恢复源布局意图，不新增视觉设计。
  if (roleId === "31dcb981-7ca3-4091-b4ad-7a0554562029") {
    cssBlocks.push(`
      .nj_ai_message_row details { text-align: left !important; }
      .nj_ai_message_row details > summary {
        text-align: left !important;
        justify-content: flex-start !important;
      }
    `);
  }
  if (cssBlocks.length === 0) return null;
  const rawCss = cssBlocks.join("\n\n");
  return convertLegacyCss(rawCss).css.trim() || null;
}

function theaterRouteStats(content: string, roleId: string) {
  const route = routeOpeningContentSplit(content, roleId);
  const inline = route.inline;
  const iframeCount =
    inline === null
      ? 0
      : inline.kind === "iframe-multi"
        ? inline.srcdocs.length
        : inline.kind === "iframe"
          ? 1
          : 0;
  return {
    route: inline?.kind ?? "floating-only",
    iframeCount,
    floatingCount: route.floating.length,
  };
}

function prepare(payload: ExportPayload): {
  cards: PreparedCard[];
  unavailable: Array<{
    name: CardName;
    roleId: string;
    status: number | null;
    reason: string;
  }>;
} {
  if (payload.includesSessionData !== false) {
    throw new Error("Input must explicitly declare includesSessionData=false");
  }
  const exportedCards = Object.values(payload.cards ?? {});
  if (exportedCards.length !== 6) {
    throw new Error(
      `Expected six exported card results, got ${exportedCards.length}`,
    );
  }

  const cards: PreparedCard[] = [];
  const unavailable: Array<{
    name: CardName;
    roleId: string;
    status: number | null;
    reason: string;
  }> = [];
  const seen = new Set<CardName>();

  for (const exported of exportedCards) {
    const expectedEntry = Object.entries(ROLE_IDS).find(
      ([, roleId]) => roleId === exported.roleId,
    );
    if (!expectedEntry) {
      throw new Error(`Unexpected roleId ${exported.roleId}`);
    }
    const expectedName = expectedEntry[0] as CardName;

    if (!exported.ok || !exported.body?.data) {
      unavailable.push({
        name: expectedName,
        roleId: exported.roleId,
        status: exported.status ?? null,
        reason:
          exported.body?.message ??
          exported.body?.error ??
          "character detail unavailable",
      });
      continue;
    }

    const detail = exported.body.data;
    const name = normalizeName(detail.name);
    if (!name)
      throw new Error(`Unexpected source character name: ${detail.name}`);
    if (name !== expectedName) {
      throw new Error(
        `roleId mapping mismatch: ${exported.roleId} expected ${expectedName}, response is ${detail.name}`,
      );
    }
    if (detail.characterId !== exported.roleId) {
      throw new Error(
        `${name}: response characterId differs from requested roleId`,
      );
    }
    if (seen.has(name)) throw new Error(`Duplicate source character: ${name}`);
    seen.add(name);

    const opening = detail.greeting ?? "";
    const codeRenderContent = detail.codeRenderContent ?? "";
    const optimizationCode = detail.optimizationCode ?? "";
    if (!opening.trim()) throw new Error(`${name}: greeting is empty`);
    if (!codeRenderContent.trim()) {
      throw new Error(`${name}: codeRenderContent is empty`);
    }

    const theater = [optimizationCode, codeRenderContent]
      .filter((value) => value.trim())
      .join("\n\n");
    const globalCss = extractGlobalCss(
      optimizationCode,
      codeRenderContent,
      exported.roleId,
    );
    const selectorCount = (
      `${optimizationCode}\n${codeRenderContent}`.match(/mufy_/g) ?? []
    ).length;
    const sanitized = globalCss
      ? sanitizeAndScopeCss(globalCss, `audit-${exported.roleId}`)
      : { css: "", warnings: [] };
    const theaterStats = theaterRouteStats(theater, exported.roleId);

    cards.push({
      name,
      roleId: exported.roleId,
      sourceName: detail.name,
      age:
        typeof detail.age === "number" && Number.isFinite(detail.age)
          ? detail.age
          : null,
      tags: Array.isArray(detail.tags)
        ? detail.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      bio: detail.description?.trim() || null,
      creatorNote: composeCreatorNote(detail),
      avatarUrl: detail.avatarUrl?.trim() || null,
      coverImageUrl: detail.backgroundUrl?.trim() || null,
      opening,
      originalOptimizationCode: optimizationCode,
      originalCodeRenderContent: codeRenderContent,
      theater,
      globalCss,
      convertedSelectorCount: selectorCount,
      sanitizedCssLength: sanitized.css.length,
      cssWarningCount: sanitized.warnings.length,
      theaterRoute: theaterStats.route,
      theaterIframeCount: theaterStats.iframeCount,
      floatingCount: theaterStats.floatingCount,
    });
  }

  return { cards, unavailable };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  const commit = process.argv.includes("--commit");
  const scope = argumentValue("--scope");
  if (commit && scope !== "TEST") {
    throw new Error("Commit is TEST-only and requires --scope TEST");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const inputPath = resolve(
    argumentValue("--input") ?? "mufy-six-role-details.json",
  );
  const reportPath = resolve(
    argumentValue("--report") ??
      "logs/card-imports/mufy-selected-20260824/original-visual-restore.json",
  );
  const inputText = await readFile(inputPath, "utf8");
  const payload = JSON.parse(inputText) as ExportPayload;
  const prepared = prepare(payload);

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const rows = await sql<
      Array<{
        id: string;
        name: CardName;
        owner_email: string;
        pack_id: string;
        opening_length: number;
        css_length: number;
        component_count: number;
      }>
    >`
      select c.id,c.name,u.email owner_email,p.id pack_id,
             length(coalesce(c.opening,''))::int opening_length,
             length(coalesce(p.global_css,''))::int css_length,
             (select count(*)::int from opening_components oc where oc.pack_id=p.id) component_count
      from characters c
      join users u on u.id=c.owner_id
      join character_pack_subscriptions s on s.character_id=c.id
      join beautification_packs p on p.id=s.pack_id
      where c.id in ${sql(Object.values(TARGET_IDS))}
      order by c.name
    `;
    if (rows.length !== Object.keys(TARGET_IDS).length) {
      throw new Error(
        `Expected six TEST character/pack rows, got ${rows.length}`,
      );
    }
    for (const row of rows) {
      if (TARGET_IDS[row.name] !== row.id) {
        throw new Error(`${row.name}: TEST character id guard failed`);
      }
      if (row.owner_email.toLowerCase() !== OWNER_EMAIL) {
        throw new Error(`${row.name}: TEST owner guard failed`);
      }
    }

    if (commit) {
      await sql.begin(async (tx) => {
        for (const card of prepared.cards) {
          const target = rows.find((row) => row.name === card.name);
          if (!target) throw new Error(`${card.name}: TEST target row missing`);

          await tx`
            update characters
            set age=${card.age},tags=${tx.json(card.tags)},bio=${card.bio},
                creator_note=${card.creatorNote},avatar_url=${card.avatarUrl},
                cover_image_url=${card.coverImageUrl},opening=${card.opening},
                visibility='public',updated_at=now()
            where id=${target.id}
          `;
          await tx`
            update beautification_packs
            set global_css=${card.globalCss},
                description=${`Mufy 原始视觉恢复（${card.roleId}）`},
                updated_at=now()
            where id=${target.pack_id}
          `;
          await tx`
            delete from opening_components where pack_id=${target.pack_id}
          `;
          await tx`
            insert into opening_components(pack_id,name,content,enabled,order_index)
            values(${target.pack_id},'Mufy 原始小剧场',${card.theater},true,0)
          `;
        }
      });
    }

    const report = {
      version: 1,
      mode: commit ? "commit" : "dry-run",
      scope: "TEST SERVER ONLY",
      generatedAt: new Date().toISOString(),
      source: {
        exportedAt: payload.exportedAt ?? null,
        endpoint: payload.source ?? null,
        inputSha256: await sha256(inputText),
        includesSessionData: payload.includesSessionData,
      },
      unavailable: prepared.unavailable,
      cards: await Promise.all(
        prepared.cards.map(async (card) => {
          const before = rows.find((row) => row.name === card.name);
          return {
            name: card.name,
            sourceName: card.sourceName,
            roleId: card.roleId,
            targetCharacterId: TARGET_IDS[card.name],
            targetPackId: before?.pack_id,
            before: before
              ? {
                  openingLength: before.opening_length,
                  globalCssLength: before.css_length,
                  openingComponentCount: before.component_count,
                }
              : null,
            after: {
              openingLength: card.opening.length,
              openingSha256: await sha256(card.opening),
              optimizationCodeLength: card.originalOptimizationCode.length,
              codeRenderContentLength: card.originalCodeRenderContent.length,
              theaterLength: card.theater.length,
              theaterSha256: await sha256(card.theater),
              globalCssLength: card.globalCss?.length ?? 0,
              globalCssSha256: card.globalCss
                ? await sha256(card.globalCss)
                : null,
              convertedSelectorCount: card.convertedSelectorCount,
              sanitizedCssLength: card.sanitizedCssLength,
              cssWarningCount: card.cssWarningCount,
              theaterRoute: card.theaterRoute,
              theaterIframeCount: card.theaterIframeCount,
              floatingCount: card.floatingCount,
              avatarUrl: card.avatarUrl,
              coverImageUrl: card.coverImageUrl,
            },
          };
        }),
      ),
    };

    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
