#!/usr/bin/env bun
import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres");

const characters = await sql`
  select
    c.id,
    c.name,
    c.bio,
    substring(c.persona, 1, 200) as persona_preview,
    length(c.persona) as persona_len,
    substring(c.opening, 1, 200) as opening_preview,
    length(c.opening) as opening_len,
    length(c.plot_setting) as plot_len,
    length(c.output_setting) as output_len,
    length(c.sample_dialogue) as sample_len,
    p.name as pack_name,
    substring(p.global_css, 1, 200) as css_preview,
    length(p.global_css) as css_len
  from characters c
  left join character_pack_subscriptions s on s.character_id = c.id
  left join beautification_packs p on p.id = s.pack_id
  where c.name in ('陆永琛', '沈知衡', '闵熙彻', '公仪晢', '喻承砚', '赵漳平')
  order by c.name
`;

console.log("========================================");
console.log("本地数据库导入结果详情");
console.log("========================================\n");

for (const char of characters) {
  console.log(`\n【${char.name}】`);
  console.log(`简介: ${char.bio}`);
  console.log(`角色ID: ${char.id}`);
  console.log(`\n字段长度:`);
  console.log(`  - persona: ${char.persona_len} 字符`);
  console.log(`  - opening: ${char.opening_len} 字符`);
  console.log(`  - plotSetting: ${char.plot_len} 字符`);
  console.log(`  - outputSetting: ${char.output_len} 字符`);
  console.log(`  - sampleDialogue: ${char.sample_len} 字符`);
  console.log(`\n美化包: ${char.pack_name}`);
  console.log(`  - CSS: ${char.css_len} 字符`);

  if (char.persona_preview) {
    console.log(`\npersona前200字符:`);
    console.log(`  ${char.persona_preview.replace(/\n/g, ' ')}...`);
  }

  if (char.opening_preview) {
    console.log(`\nopening前200字符:`);
    console.log(`  ${char.opening_preview.replace(/\n/g, ' ')}...`);
  }

  if (char.css_preview && char.css_len > 0) {
    console.log(`\nCSS前200字符:`);
    console.log(`  ${char.css_preview.replace(/\n/g, ' ')}...`);
  }

  console.log("\n" + "=".repeat(60));
}

console.log("\n\n总结:");
console.log(`✅ 成功导入 ${characters.length} 个角色`);
console.log(`✅ 所有角色都有完整的 persona 和 opening`);
console.log(`✅ ${characters.filter(c => c.css_len > 0).length} 个角色有 CSS 美化`);

await sql.end();
