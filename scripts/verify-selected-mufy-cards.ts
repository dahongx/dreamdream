#!/usr/bin/env bun

import postgres from "postgres";
import { routeOpeningContentSplit } from "../src/lib/opening/content";

const EXPECTED = {
  陆永琛: { components: ["原卡演绎室"], outputMarkers: [] },
  沈知衡: {
    components: ["原卡演绎室", "统一灵动岛播放器", "统一指令侧栏"],
    outputMarkers: ["sj-ethereal-bar", "zt-box", "xsj-container"],
  },
  闵熙彻: {
    components: ["原卡演绎室"],
    outputMarkers: [
      "status-bar-container",
      "tech-accordion-group",
      "phone-case",
    ],
  },
  公仪晢: {
    components: ["原卡演绎室", "风金播放器"],
    outputMarkers: ["cen-v2-wrap", "censy-sys-wrap"],
  },
  喻承砚: {
    components: ["原卡演绎室", "NPC与卷宗侧栏", "Omni-Cube"],
    outputMarkers: ["censy-hyper-chronos", "censy-stellar-os"],
  },
  赵漳平: {
    components: ["原卡演绎室"],
    outputMarkers: ["mufy-wg-container", "fold-item"],
  },
} as const;

const FORBIDDEN_RUNTIME_MARKERS = [
  "censy_gold_player_cache",
  "details.cen-npc-sidebar-left-v1",
  "details.censy-omnicube-v4",
  "parent.document",
] as const;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const rows = await sql<
      Array<{
        id: string;
        name: keyof typeof EXPECTED;
        persona: string;
        opening: string;
        output_setting: string | null;
        global_css: string | null;
        component_id: string;
        component_name: string;
        component_content: string;
      }>
    >`
      select c.id,c.name,c.persona,c.opening,c.output_setting,p.global_css,
             oc.id component_id,oc.name component_name,oc.content component_content
      from characters c
      join character_pack_subscriptions s on s.character_id=c.id
      join beautification_packs p on p.id=s.pack_id
      join opening_components oc on oc.pack_id=p.id and oc.enabled=true
      where c.name in ${sql(Object.keys(EXPECTED))}
        and c.owner_id=(select id from users where lower(email)='test@test.com')
      order by c.name,oc.order_index
    `;
    const results = [];
    for (const [name, expected] of Object.entries(EXPECTED) as Array<
      [keyof typeof EXPECTED, (typeof EXPECTED)[keyof typeof EXPECTED]]
    >) {
      const cardRows = rows.filter((row) => row.name === name);
      if (cardRows.length !== expected.components.length) {
        throw new Error(
          `${name}: expected ${expected.components.length} components, got ${cardRows.length}`,
        );
      }
      const first = cardRows[0];
      if (!first.persona.trim() || !first.opening.trim()) {
        throw new Error(`${name}: core prompt field is empty`);
      }
      const output = first.output_setting ?? "";
      for (const marker of expected.outputMarkers) {
        if (!output.includes(marker)) {
          throw new Error(`${name}: missing output marker ${marker}`);
        }
      }
      for (const marker of FORBIDDEN_RUNTIME_MARKERS) {
        if (output.includes(marker)) {
          throw new Error(`${name}: stale Mufy runtime marker ${marker}`);
        }
      }
      const componentResults = cardRows.map((row) => {
        if (!expected.components.includes(row.component_name as never)) {
          throw new Error(
            `${name}: unexpected component ${row.component_name}`,
          );
        }
        const route = routeOpeningContentSplit(
          row.component_content,
          row.component_id,
        );
        if (row.component_name === "原卡演绎室" && route.inline === null) {
          throw new Error(`${name}: opening reel did not route inline`);
        }
        if (
          row.component_name !== "原卡演绎室" &&
          route.floating.length !== 1
        ) {
          throw new Error(
            `${name}/${row.component_name}: floating route failed`,
          );
        }
        return {
          name: row.component_name,
          length: row.component_content.length,
          inline: route.inline?.kind ?? null,
          floating: route.floating.map((item) => ({
            pos: item.meta.pos,
            needsShim: item.meta.needsShim ?? false,
          })),
        };
      });
      results.push({
        name,
        personaLength: first.persona.length,
        openingLength: first.opening.length,
        outputSettingLength: output.length,
        globalCssLength: first.global_css?.length ?? 0,
        components: componentResults,
      });
    }
    console.log(
      JSON.stringify(
        { ok: true, checkedAt: new Date().toISOString(), cards: results },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
