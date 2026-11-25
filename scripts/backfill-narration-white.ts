#!/usr/bin/env bun
/**
 * 旁白(narration)字色回填：5 张卡的 .nj_message_narration 深灰 → 近白
 *
 * Why:
 *   贺韫 / Alpha坏狗联盟 / 程彧 / 萧予夺 / 文时安 这 5 张卡的 globalCss 里
 *   `.nj_message_narration { color: var(--text-secondary) !important }`，而这几张卡
 *   把 --text-secondary 定义成深灰(#6C757D 等，原为浅底设计)。搬到寄情深底
 *   (#0e0a1a)后旁白发暗读不清。来源平台上这段是白的。
 *
 * What（精准、最小改动）:
 *   只把 `.nj_message_narration { ... }` **规则块内部**的 `var(--text-secondary)`
 *   替换成近白 #f5f0fa（含 color 与 -webkit-text-fill-color 两处）。
 *   **不动 --text-secondary 变量定义本身**（它在别处可能还有用），也不碰规则块外的
 *   任何内容 —— 只让旁白变白，其余美化一律不变。
 *
 * Modes:
 *   --dry-run   只算不写，打印将改动的卡与前后片段
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (check .env.local)");
  process.exit(1);
}
const dryRun = process.argv.slice(2).includes("--dry-run");
const isPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isPooler });

const TARGET_NAMES = ["贺韫", "Alpha坏狗联盟", "程彧", "萧予夺", "文时安"];
const WHITE = "#f5f0fa";

// 只替换 .nj_message_narration { ... } 规则块内部的 var(--text-secondary)。
// 匹配「nj_message_narration 到最近的 }」这一段，段内做替换。
function recolorNarration(css: string): { next: string; changed: boolean } {
  const re = /(\.nj_message_narration\b[^{]*\{)([^}]*)(\})/gi;
  let changed = false;
  const next = css.replace(re, (_m, head, body, tail) => {
    const newBody = body.replace(/var\(\s*--text-secondary\s*\)/gi, WHITE);
    if (newBody !== body) changed = true;
    return `${head}${newBody}${tail}`;
  });
  return { next, changed };
}

async function main() {
  const rows = await sql<
    { id: string; name: string; charName: string; globalCss: string }[]
  >`
    SELECT DISTINCT p.id, p.name, ch.name AS "charName", p.global_css AS "globalCss"
    FROM beautification_packs p
    JOIN character_pack_subscriptions s ON s.pack_id = p.id
    JOIN characters ch ON ch.id = s.character_id
    WHERE ch.name = ANY(${TARGET_NAMES})
      AND p.global_css IS NOT NULL AND p.global_css <> ''
  `;

  let hit = 0;
  for (const r of rows) {
    const { next, changed } = recolorNarration(r.globalCss);
    if (!changed) {
      console.log(`  skip（无 narration var 引用）: ${r.charName} / ${r.name}`);
      continue;
    }
    hit++;
    console.log(
      `  ${dryRun ? "[dry]" : "改"} ${r.charName} / ${r.name} (${r.id})`,
    );
    if (!dryRun) {
      await sql`UPDATE beautification_packs SET global_css = ${next} WHERE id = ${r.id}`;
    }
  }
  console.log(`\n${dryRun ? "[dry-run] 将改动" : "已改动"}：${hit} 个包`);
  if (dryRun) console.log("（dry-run，未写库。去掉 --dry-run 实际执行。）");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
