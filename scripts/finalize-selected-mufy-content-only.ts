#!/usr/bin/env bun

/**
 * Finalize the six selected Mufy cards on TEST using only assets whose
 * provenance is known. The supplied JSON is an assembled prompt archive,
 * not a full card export: independent global CSS and opening theater assets
 * are intentionally left empty instead of being reconstructed.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const CARDS = {
  陆永琛: {
    id: "252e1466-9dcd-48cb-a580-dc97c9df85fb",
    avatarUrl:
      "https://cdn.rubii.ai/public/character/chara_68135c7c27d387c21b86b7fc.webp",
    coverImageUrl:
      "https://cdn.rubii.ai/public/moment/68135c7c27d387c21b86b7fd_large.webp",
    mediaProvenance: "Rubii 同名公开迁移卡的角色主图与时刻封面",
  },
  沈知衡: {
    id: "8143f91a-15d1-40a6-8a41-5b7f31f9dedf",
    avatarUrl: "https://i.postimg.cc/qq16bzkC/szh_tx.png",
    coverImageUrl: "https://i.postimg.cc/qMjWr19x/szhback.jpg",
    mediaProvenance: "源 Prompt 明确标注的沈知衡头像与朋友圈封面",
  },
  闵熙彻: {
    id: "5f1599a2-f379-4071-bf81-6b4c0450c1a9",
    avatarUrl: null,
    coverImageUrl: null,
    mediaProvenance:
      "源 Prompt 只有语音图标与表情包，没有可确认的角色主图；保持空白",
  },
  公仪晢: {
    id: "8c0c0995-b9b1-4fe2-a78c-cfe3bfeae8a4",
    avatarUrl: null,
    coverImageUrl: null,
    mediaProvenance: "源 Prompt 无图片 URL；保持空白",
  },
  喻承砚: {
    id: "8667c339-beff-4478-bb9b-a707cc96fb16",
    avatarUrl: null,
    coverImageUrl: null,
    mediaProvenance: "源 Prompt 无图片 URL；保持空白",
  },
  赵漳平: {
    id: "b6244940-5822-4f22-a256-c956828c8dd2",
    avatarUrl:
      "https://cdn.rubii.ai/public/180c7aa1-78b4-4435-96e3-bb74a471cef8/image/20260809073423_5ba198.jpg",
    coverImageUrl:
      "https://cdn.rubii.ai/public/180c7aa1-78b4-4435-96e3-bb74a471cef8/image/20260809073423_5ba198.jpg",
    mediaProvenance: "Rubii 同名公开迁移卡的角色主图",
  },
} as const;

type CardName = keyof typeof CARDS;
type SourceRecord = {
  character_name?: unknown;
  found?: unknown;
  prompt?: unknown;
};

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function extractSection(prompt: string, tag: string): string {
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

  const sourcePath = resolve(
    argumentValue("--input") ?? "selected_character_prompts(1).json",
  );
  const backupPath = resolve(
    argumentValue("--backup") ??
      "logs/card-imports/mufy-selected-20260824/content-only-before.json",
  );
  const reportPath = resolve(
    argumentValue("--report") ??
      "logs/card-imports/mufy-selected-20260824/content-only-final.json",
  );
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
  const desired = (
    Object.entries(CARDS) as Array<[CardName, (typeof CARDS)[CardName]]>
  ).map(([name, spec]) => {
    const matches = records.filter(
      (record) => record.character_name === name && record.found === true,
    );
    if (matches.length !== 1 || typeof matches[0].prompt !== "string") {
      throw new Error(`Expected one complete source prompt for ${name}`);
    }
    const prompt = matches[0].prompt;
    return {
      name,
      ...spec,
      persona: extractSection(prompt, "CharaPrompt"),
      opening: extractSection(prompt, "Greeting"),
      plotSetting: extractSection(prompt, "PlotSetting"),
      outputSetting: extractSection(prompt, "OutputSetting"),
      sampleDialogue: extractSection(prompt, "StyleSamples"),
    };
  });

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const ids = desired.map((card) => card.id);
    const rows = await sql<
      Array<{
        id: string;
        name: string;
        persona: string;
        adversity: string | null;
        default_cognition: string | null;
        opening: string | null;
        plot_setting: string | null;
        output_setting: string | null;
        sample_dialogue: string | null;
        avatar_url: string | null;
        cover_image_url: string | null;
        visibility: string;
        pack_id: string;
        pack_name: string;
        pack_description: string | null;
        global_css: string | null;
      }>
    >`
      select c.id,c.name,c.persona,c.adversity,c.default_cognition,c.opening,
             c.plot_setting,c.output_setting,c.sample_dialogue,c.avatar_url,
             c.cover_image_url,c.visibility,p.id pack_id,p.name pack_name,
             p.description pack_description,p.global_css
      from characters c
      join character_pack_subscriptions s on s.character_id=c.id
      join beautification_packs p on p.id=s.pack_id
      where c.id in ${sql(ids)}
      order by c.name
    `;
    if (rows.length !== desired.length) {
      throw new Error(
        `Expected one TEST card/pack row for each card (${desired.length}), got ${rows.length}`,
      );
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const card of desired) {
      const row = byId.get(card.id);
      if (!row || row.name !== card.name) {
        throw new Error(`${card.name}: TEST id/name guard failed`);
      }
    }

    const packIds = rows.map((row) => row.pack_id);
    const components = await sql`
      select * from opening_components
      where pack_id in ${sql(packIds)}
      order by pack_id,order_index,id
    `;
    const rules = await sql`
      select * from regex_rules
      where pack_id in ${sql(packIds)}
      order by pack_id,id
    `;

    const backup = {
      version: 1,
      scope: "TEST ONLY",
      generatedAt: new Date().toISOString(),
      charactersAndPacks: rows,
      openingComponents: components,
      regexRules: rules,
    };
    await mkdir(dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");

    if (commit) {
      await sql.begin(async (tx) => {
        for (const card of desired) {
          const before = byId.get(card.id);
          if (!before) throw new Error(`${card.name}: missing guarded row`);
          await tx`
            update characters
            set persona=${card.persona}, adversity=null, default_cognition=null,
                opening=${card.opening}, plot_setting=${card.plotSetting},
                output_setting=${card.outputSetting},
                sample_dialogue=${card.sampleDialogue},
                avatar_url=${card.avatarUrl},
                cover_image_url=${card.coverImageUrl}, updated_at=now()
            where id=${card.id} and name=${card.name}
          `;
          await tx`
            update beautification_packs
            set global_css=null,
                description=${"由 Mufy Prompt 数据迁移；源数据未提供独立全局美化和小剧场，保持空白。"},
                updated_at=now()
            where id=${before.pack_id}
          `;
        }
        await tx`
          delete from opening_components where pack_id in ${tx(packIds)}
        `;
      });
    }

    type AfterRow = {
      id: string;
      name: string;
      persona: string;
      opening: string | null;
      plot_setting: string | null;
      output_setting: string | null;
      sample_dialogue: string | null;
      avatar_url: string | null;
      cover_image_url: string | null;
      global_css: string | null;
      component_count: number;
      regex_count: number;
    };
    const afterRows: AfterRow[] = commit
      ? await sql<AfterRow[]>`
          select c.id,c.name,c.persona,c.opening,c.plot_setting,c.output_setting,
                 c.sample_dialogue,c.avatar_url,c.cover_image_url,p.global_css,
                 (select count(*)::int from opening_components oc where oc.pack_id=p.id) component_count,
                 (select count(*)::int from regex_rules rr where rr.pack_id=p.id) regex_count
          from characters c
          join character_pack_subscriptions s on s.character_id=c.id
          join beautification_packs p on p.id=s.pack_id
          where c.id in ${sql(ids)}
          order by c.name
        `
      : [];
    const afterById = new Map(afterRows.map((row) => [row.id, row]));

    const cards = [];
    for (const card of desired) {
      const before = byId.get(card.id);
      if (!before) throw new Error(`${card.name}: missing before row`);
      const after = afterById.get(card.id);
      if (commit) {
        if (!after) throw new Error(`${card.name}: missing after row`);
        const exactChecks = [
          ["persona", after.persona, card.persona],
          ["opening", after.opening, card.opening],
          ["plotSetting", after.plot_setting, card.plotSetting],
          ["outputSetting", after.output_setting, card.outputSetting],
          ["sampleDialogue", after.sample_dialogue, card.sampleDialogue],
        ] as const;
        for (const [field, actual, expected] of exactChecks) {
          if ((await sha256(actual)) !== (await sha256(expected))) {
            throw new Error(`${card.name}: ${field} does not match source`);
          }
        }
        if (after.global_css !== null || after.component_count !== 0) {
          throw new Error(
            `${card.name}: independent beautification assets are not empty`,
          );
        }
        if (after.regex_count !== 0) {
          throw new Error(`${card.name}: unexpected regex rules exist`);
        }
      }
      cards.push({
        name: card.name,
        id: card.id,
        packId: before.pack_id,
        promptFields: {
          persona: card.persona.length,
          opening: card.opening.length,
          plotSetting: card.plotSetting.length,
          outputSetting: card.outputSetting.length,
          sampleDialogue: card.sampleDialogue.length,
          sourceExact: commit,
        },
        removed: {
          syntheticGlobalCssLength: before.global_css?.length ?? 0,
          openingComponents: components.filter(
            (component) => component.pack_id === before.pack_id,
          ).length,
        },
        media: {
          avatarUrl: card.avatarUrl,
          coverImageUrl: card.coverImageUrl,
          provenance: card.mediaProvenance,
        },
      });
    }

    const report = {
      version: 1,
      mode: commit ? "commit" : "dry-run",
      scope: "TEST ONLY",
      sourcePath,
      backupPath,
      policy: {
        globalCss: "empty: source field not supplied",
        openingTheater: "empty: source field not supplied",
        greeting:
          "characters.opening only; never copied into opening_components",
        media: "only source-labeled or independently verified same-card images",
      },
      cards,
    };
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
