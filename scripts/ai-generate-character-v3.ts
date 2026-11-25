#!/usr/bin/env bun
/**
 * AI生成角色卡 - 简化版本
 * 直接从AI响应中提取字段，而不是解析JSON
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, mkdir } from 'fs/promises';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  console.log('📖 读取小说素材...');
  const novelData = JSON.parse(
    await readFile('character-creation-toolkit/test-novel-ceo.json', 'utf-8')
  );

  console.log('📖 读取mufy样本...');
  const mufySample = JSON.parse(
    await readFile('character-creation-toolkit/mufy-samples/方鹤之.json', 'utf-8')
  );

  console.log('🤖 调用AI生成角色数据...');

  const prompt = `你是专业的角色卡创作者。基于小说素材生成角色卡。

# 小说素材
${JSON.stringify(novelData, null, 2)}

# mufy风格参考（学习写作风格）
角色名: ${mufySample.character.name}
Persona示例（前2000字）:
${mufySample.character.persona.substring(0, 2000)}

# 任务

生成角色：${novelData.protagonist.name}

要求：
1. persona必须10000字以上，学习mufy的长句、心理描写、情绪细节
2. 包含：外貌、性格、背景、行为模式、与玩家关系、各种场景反应
3. opening: 500-1000字开场白
4. sampleDialogue: 800-1500字示例对话

# 输出格式

直接输出各字段内容，用【字段名】标记：

【name】
${novelData.protagonist.name}

【gender】
male

【age】
32

【tags】
总裁, 追妻火葬场, 先婚后爱, 误会, 救赎, 商战, 偏执, 冷面深情

【bio】
（150字简介）

【persona】
（10000字以上完整人设，学习mufy风格）

【opening】
（500-1000字开场白）

【sampleDialogue】
（800-1500字示例对话）`;

  const stream = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 64000,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  });

  let responseText = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      responseText += chunk.delta.text;
      process.stdout.write('.');
    }
  }
  console.log('\n');

  // 提取各字段
  const extract = (fieldName: string) => {
    const regex = new RegExp(`【${fieldName}】\\s*([\\s\\S]*?)(?=【|$)`);
    const match = responseText.match(regex);
    return match ? match[1].trim() : '';
  };

  const character = {
    name: extract('name') || novelData.protagonist.name,
    gender: extract('gender') || 'male',
    age: parseInt(extract('age')) || 32,
    tags: extract('tags').split(/[,，]/).map(t => t.trim()).filter(Boolean),
    bio: extract('bio'),
    persona: extract('persona'),
    opening: extract('opening'),
    sampleDialogue: extract('sampleDialogue'),
  };

  // 保存
  await mkdir('character-creation-toolkit/generated', { recursive: true });
  const outputPath = `character-creation-toolkit/generated/${character.name}-character.json`;
  await writeFile(outputPath, JSON.stringify(character, null, 2), 'utf-8');

  console.log(`✅ 角色数据已生成: ${outputPath}`);
  console.log('\n📊 数据统计:');
  console.log(`   name: ${character.name}`);
  console.log(`   tags: ${character.tags.join(', ')}`);
  console.log(`   bio: ${character.bio.length} 字符`);
  console.log(`   persona: ${character.persona.length} 字符`);
  console.log(`   opening: ${character.opening.length} 字符`);
  console.log(`   sampleDialogue: ${character.sampleDialogue.length} 字符`);

  process.exit(0);
}

main().catch(console.error);
