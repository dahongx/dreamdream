#!/usr/bin/env bun
/**
 * Import the six selected Mufy prompt records into Dearm.
 *
 * Safety properties:
 * - dry-run by default; --commit is required to write
 * - exact six-name allowlist
 * - never overwrites an existing character with the same owner/name
 * - all inserts are performed in one database transaction
 * - writes a machine-readable audit/rollback manifest
 *
 * This source JSON contains final assembled prompts, not complete Mufy card
 * exports. Only character-specific tagged sections are migrated. Runtime HTML
 * and bootstrap scripts embedded in those sections are preserved verbatim.
 * Mufy's separate codeRenderContent (小剧场), beautification.styleCode and
 * regexRules fields are not present in this file and must never be invented
 * from the prompt or replaced with a hand-built visual approximation.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const CHARACTER_SPECS = [
  {
    name: "陆永琛",
    age: 40,
    bio: "永昌国际集团执行董事",
  },
  {
    name: "沈知衡",
    age: 39,
    bio: "沈氏掌权人，「涵澹资本」核心",
  },
  {
    name: "闵熙彻",
    age: 20,
    bio: "京大戏剧学院模特系学生、网红",
  },
  {
    name: "公仪晢",
    age: 26,
    bio: "大殷承安帝",
  },
  {
    name: "喻承砚",
    age: 31,
    bio: "承远集团总裁",
  },
  {
    name: "赵漳平",
    age: 35,
    bio: "闽市政务总长",
  },
] as const;

const SECTION_MAPPING = {
  CharaPrompt: "persona",
  Greeting: "opening",
  PlotSetting: "plotSetting",
  OutputSetting: "outputSetting",
  StyleSamples: "sampleDialogue",
} as const;

type SectionTag = keyof typeof SECTION_MAPPING;
type SourceRecord = {
  character_name?: unknown;
  found?: unknown;
  match_type?: unknown;
  character_key?: unknown;
  canonical_prompt_hash?: unknown;
  variant_count?: unknown;
  source_length?: unknown;
  prompt?: unknown;
};

type ExtractedCard = {
  name: string;
  age: number;
  bio: string;
  source: {
    matchType: string | null;
    characterKey: string | null;
    canonicalPromptHash: string | null;
    variantCount: number | null;
    declaredLength: number | null;
    actualLength: number;
  };
  fields: {
    persona: string;
    adversity: null;
    defaultCognition: null;
    opening: string | null;
    plotSetting: string | null;
    outputSetting: string | null;
    sampleDialogue: string | null;
  };
  sectionLengths: Record<SectionTag, number>;
};

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractSection(prompt: string, tag: SectionTag): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const firstClose = prompt.indexOf(close);
  // The Mufy master prompt names these opening tags before the actual payload.
  // Pair the sole closing tag with its nearest preceding opening tag.
  const payloadOpen = prompt.lastIndexOf(open, firstClose);
  if (payloadOpen < 0 || firstClose < 0 || firstClose < payloadOpen) {
    throw new Error(`Missing or malformed <${tag}> section`);
  }
  if (prompt.indexOf(close, firstClose + close.length) >= 0) {
    throw new Error(`Duplicate </${tag}> section`);
  }
  return prompt.slice(payloadOpen + open.length, firstClose);
}

function parseCards(raw: string): ExtractedCard[] {
  const parsed: unknown = JSON.parse(raw);
  const sourceRecords = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        "characters" in parsed &&
        Array.isArray(parsed.characters)
      ? parsed.characters
      : null;
  if (!sourceRecords) {
    throw new Error(
      "Source JSON must be an array or contain a characters array",
    );
  }

  const records = sourceRecords as SourceRecord[];
  const sourceNames = records.map((item) => item.character_name);
  const cards: ExtractedCard[] = [];

  for (const spec of CHARACTER_SPECS) {
    const matches = records.filter((item) => item.character_name === spec.name);
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one source record for ${spec.name}, got ${matches.length}`,
      );
    }
    const record = matches[0];
    if (record.found !== true || typeof record.prompt !== "string") {
      throw new Error(`${spec.name} is not a complete prompt record`);
    }

    const sections = Object.fromEntries(
      (Object.keys(SECTION_MAPPING) as SectionTag[]).map((tag) => [
        tag,
        extractSection(record.prompt as string, tag),
      ]),
    ) as Record<SectionTag, string>;

    if (sections.CharaPrompt.trim().length === 0) {
      throw new Error(`${spec.name} has an empty CharaPrompt`);
    }

    const optional = (value: string) =>
      value.trim().length > 0 ? value : null;
    cards.push({
      name: spec.name,
      age: spec.age,
      bio: spec.bio,
      source: {
        matchType: nullableString(record.match_type),
        characterKey: nullableString(record.character_key),
        canonicalPromptHash: nullableString(record.canonical_prompt_hash),
        variantCount: nullableNumber(record.variant_count),
        declaredLength: nullableNumber(record.source_length),
        actualLength: record.prompt.length,
      },
      fields: {
        persona: sections.CharaPrompt,
        adversity: null,
        defaultCognition: null,
        opening: optional(sections.Greeting),
        plotSetting: optional(sections.PlotSetting),
        outputSetting: optional(sections.OutputSetting),
        sampleDialogue: optional(sections.StyleSamples),
      },
      sectionLengths: Object.fromEntries(
        (Object.keys(sections) as SectionTag[]).map((tag) => [
          tag,
          sections[tag].length,
        ]),
      ) as Record<SectionTag, number>,
    });
  }

  const unexpectedCompleteNames = sourceNames.filter(
    (name) =>
      typeof name === "string" &&
      !CHARACTER_SPECS.some((spec) => spec.name === name) &&
      records.some(
        (record) => record.character_name === name && record.found === true,
      ),
  );
  if (unexpectedCompleteNames.length > 0) {
    console.warn(
      `Ignoring non-allowlisted complete records: ${unexpectedCompleteNames.join(", ")}`,
    );
  }
  return cards;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  const commit = process.argv.includes("--commit");
  const inputPath = resolve(
    argumentValue("--input") ??
      resolve(process.cwd(), "selected_character_prompts(1).json"),
  );
  const reportPath = resolve(
    argumentValue("--report") ??
      resolve(process.cwd(), "logs/card-imports/selected-mufy-import.json"),
  );
  const ownerEmail = argumentValue("--owner-email") ?? "test@test.com";
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  console.log(`[import] reading ${inputPath}`);
  const raw = await readFile(inputPath, "utf8");
  const cards = parseCards(raw);
  console.log(`[import] extracted ${cards.length} cards`);
  const sourceSha256 = await sha256(raw);
  console.log(`[import] source sha256 ${sourceSha256}`);
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log(`[import] resolving owner ${ownerEmail}`);
    const owners = await sql<
      [{ id: string; email: string; role: string }]
    >`select id, email, role from users where lower(email) = lower(${ownerEmail})`;
    if (owners.length !== 1) {
      throw new Error(
        `Expected exactly one owner for ${ownerEmail}, got ${owners.length}`,
      );
    }
    const owner = owners[0];
    if (owner.role !== "admin") {
      throw new Error(
        `Owner ${ownerEmail} is not an admin (role=${owner.role})`,
      );
    }

    console.log("[import] checking for existing character names");
    const existing = await sql<{ id: string; name: string }[]>`
      select id, name
      from characters
      where owner_id = ${owner.id}
        and name in ${sql(cards.map((card) => card.name))}
      order by name
    `;
    if (existing.length > 0) {
      throw new Error(
        `Refusing to overwrite existing characters: ${existing.map((row) => `${row.name}:${row.id}`).join(", ")}`,
      );
    }

    const baseReport = {
      version: 1,
      mode: commit ? "commit" : "dry-run",
      generatedAt: new Date().toISOString(),
      inputPath,
      sourceSha256,
      owner,
      mapping: SECTION_MAPPING,
      exclusions: {
        mufyMasterPrompt:
          "excluded to prevent duplication with Dearm master prompt",
        adversity: "not separately represented in source JSON",
        defaultCognition: "not separately represented in source JSON",
        avatarAndCover: "not present in source JSON",
        beautificationAssets:
          "Prompt sections contain response HTML, status panels, some inline CSS/resources and cache bootstrap scripts; these stay in their original prompt fields. The source JSON does not contain the separate Mufy codeRenderContent (小剧场), beautification.styleCode or regexRules fields, so those assets require the complete card export/backend record.",
      },
      cards: cards.map((card) => ({
        name: card.name,
        age: card.age,
        bio: card.bio,
        source: card.source,
        sectionLengths: card.sectionLengths,
      })),
    };

    if (!commit) {
      console.log("[import] dry-run complete; no database writes performed");
      console.log(JSON.stringify(baseReport, null, 2));
      return;
    }

    console.log("[import] beginning transaction");
    const inserted = await sql.begin(async (tx) => {
      const result: Array<{
        name: string;
        characterId: string;
        packId: string;
      }> = [];
      for (const card of cards) {
        const [character] = await tx<{ id: string }[]>`
          insert into characters (
            owner_id, name, gender, age, nsfw, is_ai, content_type,
            tags, bio, visibility, persona, adversity, default_cognition,
            opening, plot_setting, output_setting, sample_dialogue
          ) values (
            ${owner.id}, ${card.name}, 'male', ${card.age}, true, false, 'original',
            ${tx.json([])}, ${card.bio}, 'private', ${card.fields.persona},
            ${card.fields.adversity}, ${card.fields.defaultCognition}, ${card.fields.opening},
            ${card.fields.plotSetting}, ${card.fields.outputSetting}, ${card.fields.sampleDialogue}
          )
          returning id
        `;
        const [pack] = await tx<{ id: string }[]>`
          insert into beautification_packs (owner_user_id, name, description, is_public)
          values (
            ${owner.id}, ${`${card.name} 的美化包`},
            ${"由 Mufy 角色提示词数据迁移；源文件未包含独立 CSS、正则或开场组件。"}, false
          )
          returning id
        `;
        await tx`
          insert into character_pack_subscriptions (character_id, pack_id, order_index)
          values (${character.id}, ${pack.id}, 0)
        `;
        result.push({
          name: card.name,
          characterId: character.id,
          packId: pack.id,
        });
      }
      return result;
    });

    const report = { ...baseReport, inserted };
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
