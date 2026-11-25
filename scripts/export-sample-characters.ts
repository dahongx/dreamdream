#!/usr/bin/env bun
/**
 * 导出示例角色卡数据，用于分析模板结构
 */

import postgres from 'postgres';
import { writeFileSync } from 'fs';

const sql = postgres(process.env.DATABASE_URL!);

async function exportSampleCharacters() {
  console.log('查询角色卡数据...');

  // 查询前 3 张 public 角色卡，优先对话数高的
  const characters = await sql`
    SELECT
      id, name, tags, gender, age, nsfw, bio,
      persona, adversity, default_cognition, opening,
      plot_setting, output_setting, sample_dialogue,
      conversation_count
    FROM characters
    WHERE visibility = 'public'
    ORDER BY conversation_count DESC NULLS LAST
    LIMIT 3
  `;

  console.log(`找到 ${characters.length} 张角色卡`);

  // 同时查询每张卡的美化数据
  for (const char of characters) {
    console.log(`\n角色: ${char.name}`);
    console.log(`  对话数: ${char.conversation_count}`);
    console.log(`  标签: ${char.tags.join(', ')}`);

    // 查询正则规则
    const rules = await sql`
      SELECT id, name, mode, tool_type, pattern, replacement, output_guidance
      FROM regex_rules
      WHERE character_id = ${char.id}
      ORDER BY sort_order
    `;

    console.log(`  正则规则数: ${rules.length}`);

    // 查询开场组件
    const openingComponents = await sql`
      SELECT id, name, content
      FROM opening_components
      WHERE character_id = ${char.id}
      ORDER BY sort_order
    `;

    console.log(`  开场组件数: ${openingComponents.length}`);

    // 组装完整数据
    (char as any).regexRules = rules;
    (char as any).openingComponents = openingComponents;
  }

  // 写入文件
  const output = JSON.stringify(characters, null, 2);
  writeFileSync('./character-samples.json', output, 'utf-8');

  console.log('\n已导出到 character-samples.json');

  // 打印简要统计
  console.log('\n=== 统计 ===');
  for (const char of characters) {
    console.log(`\n${char.name}:`);
    console.log(`  persona 长度: ${char.persona?.length || 0} 字符`);
    console.log(`  opening 长度: ${char.opening?.length || 0} 字符`);
    console.log(`  plot_setting 长度: ${char.plot_setting?.length || 0} 字符`);
    console.log(`  sample_dialogue 长度: ${char.sample_dialogue?.length || 0} 字符`);
  }

  await sql.end();
}

exportSampleCharacters().catch(console.error);
