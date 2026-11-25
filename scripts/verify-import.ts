#!/usr/bin/env bun
import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres");

const characters = await sql`
  select
    c.id,
    c.name,
    length(c.persona) as persona_len,
    length(c.opening) as opening_len,
    length(c.plot_setting) as plot_len,
    length(c.output_setting) as output_len,
    length(c.sample_dialogue) as sample_len,
    p.id as pack_id,
    p.name as pack_name,
    length(p.global_css) as css_len
  from characters c
  left join character_pack_subscriptions s on s.character_id = c.id
  left join beautification_packs p on p.id = s.pack_id
  where c.name in ('陆永琛', '沈知衡', '闵熙彻', '公仪晢', '喻承砚', '赵漳平')
  order by c.name
`;

console.log("导入的角色验证:\n");
characters.forEach(r => {
  console.log(`${r.name}:`);
  console.log(`  角色ID: ${r.id}`);
  console.log(`  persona: ${r.persona_len} 字符`);
  console.log(`  opening: ${r.opening_len} 字符`);
  console.log(`  plotSetting: ${r.plot_len} 字符`);
  console.log(`  outputSetting: ${r.output_len} 字符`);
  console.log(`  sampleDialogue: ${r.sample_len} 字符`);
  console.log(`  美化包: ${r.pack_name} (ID: ${r.pack_id})`);
  console.log(`  CSS: ${r.css_len} 字符`);
  console.log("");
});

await sql.end();
