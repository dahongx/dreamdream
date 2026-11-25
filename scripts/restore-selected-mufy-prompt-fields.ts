#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import postgres from "postgres";

const EXPECTED_IDS = {
  陆永琛: "252e1466-9dcd-48cb-a580-dc97c9df85fb",
  沈知衡: "8143f91a-15d1-40a6-8a41-5b7f31f9dedf",
  闵熙彻: "5f1599a2-f379-4071-bf81-6b4c0450c1a9",
  公仪晢: "8c0c0995-b9b1-4fe2-a78c-cfe3bfeae8a4",
  喻承砚: "8667c339-beff-4478-bb9b-a707cc96fb16",
  赵漳平: "b6244940-5822-4f22-a256-c956828c8dd2",
} as const;

const SECTION_COLUMNS = {
  CharaPrompt: "persona",
  Greeting: "opening",
  PlotSetting: "plotSetting",
  OutputSetting: "outputSetting",
  StyleSamples: "sampleDialogue",
} as const;

type CardName = keyof typeof EXPECTED_IDS;
type SectionTag = keyof typeof SECTION_COLUMNS;

type SourceRecord = {
  character_name?: unknown;
  found?: unknown;
  prompt?: unknown;
};

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function extractSection(prompt: string, tag: SectionTag): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const closeIndex = prompt.indexOf(close);
  const openIndex = prompt.lastIndexOf(open, closeIndex);
  if (openIndex < 0 || closeIndex < openIndex) {
    throw new Error(`Missing or malformed <${tag}> section`);
  }
  if (prompt.indexOf(close, closeIndex + close.length) >= 0) {
    throw new Error(`Duplicate </${tag}> section`);
  }
  return prompt.slice(openIndex + open.length, closeIndex);
}

async function sha256(value: string | null): Promise<string | null> {
  if (value === null) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sourcePath = argumentValue("--input");
  if (!sourcePath) throw new Error("--input is required");
  const commit = process.argv.includes("--commit");

  const parsed: unknown = JSON.parse(await readFile(sourcePath, "utf8"));
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("characters" in parsed) ||
    !Array.isArray(parsed.characters)
  ) {
    throw new Error("Source JSON must contain a characters array");
  }

  const records = parsed.characters as SourceRecord[];
  const cards = (Object.keys(EXPECTED_IDS) as CardName[]).map((name) => {
    const matches = records.filter(
      (record) => record.character_name === name && record.found === true,
    );
    if (matches.length !== 1 || typeof matches[0].prompt !== "string") {
      throw new Error(`Expected one complete prompt for ${name}`);
    }
    const prompt = matches[0].prompt;
    return {
      id: EXPECTED_IDS[name],
      name,
      persona: extractSection(prompt, "CharaPrompt"),
      opening: extractSection(prompt, "Greeting"),
      plotSetting: extractSection(prompt, "PlotSetting"),
      outputSetting: extractSection(prompt, "OutputSetting"),
      sampleDialogue: extractSection(prompt, "StyleSamples"),
    };
  });

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql<
      Array<{
        id: string;
        name: string;
        persona: string;
        opening: string | null;
        plot_setting: string | null;
        output_setting: string | null;
        sample_dialogue: string | null;
      }>
    >`
      select id, name, persona, opening, plot_setting, output_setting, sample_dialogue
      from characters
      where id in ${sql(cards.map((card) => card.id))}
      order by name
    `;
    if (rows.length !== cards.length) {
      throw new Error(`Expected ${cards.length} TEST rows, got ${rows.length}`);
    }

    const beforeById = new Map(rows.map((row) => [row.id, row]));
    for (const card of cards) {
      const before = beforeById.get(card.id);
      if (!before || before.name !== card.name) {
        throw new Error(`${card.name}: TEST id/name guard failed`);
      }
    }

    if (commit) {
      await sql.begin(async (tx) => {
        for (const card of cards) {
          await tx`
            update characters
            set persona=${card.persona}, opening=${card.opening},
                plot_setting=${card.plotSetting},
                output_setting=${card.outputSetting},
                sample_dialogue=${card.sampleDialogue}, updated_at=now()
            where id=${card.id} and name=${card.name}
          `;
        }
      });
    }

    const report = [];
    for (const card of cards) {
      const before = beforeById.get(card.id);
      if (!before) throw new Error(`${card.name}: missing before row`);
      report.push({
        name: card.name,
        id: card.id,
        before: {
          personaLength: before.persona.length,
          openingLength: before.opening?.length ?? 0,
          plotSettingLength: before.plot_setting?.length ?? 0,
          outputSettingLength: before.output_setting?.length ?? 0,
          sampleDialogueLength: before.sample_dialogue?.length ?? 0,
          outputSettingSha256: await sha256(before.output_setting),
        },
        source: {
          personaLength: card.persona.length,
          openingLength: card.opening.length,
          plotSettingLength: card.plotSetting.length,
          outputSettingLength: card.outputSetting.length,
          sampleDialogueLength: card.sampleDialogue.length,
          outputSettingSha256: await sha256(card.outputSetting),
        },
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: commit ? "commit" : "dry-run",
          scope: "TEST ONLY",
          touched: Object.values(SECTION_COLUMNS),
          explicitlyUntouched: [
            "globalCss",
            "openingComponents",
            "regexRules",
            "media",
            "visibility",
          ],
          cards: report,
        },
        null,
        2,
      ),
    );
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
