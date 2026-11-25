#!/usr/bin/env bun
/**
 * AI生成角色卡（基于小说 + mufy风格）
 *
 * 输入：
 *   1. 小说素材JSON (test-novel-ceo.json)
 *   2. mufy样本JSON (方鹤之.json)
 *
 * 输出：
 *   character-creation-toolkit/generated/沈亦寒-character.json
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

  const prompt = `你是一个专业的角色卡创作者。现在要基于小说素材生成一个角色卡。

# 小说素材
${JSON.stringify(novelData, null, 2)}

# mufy风格参考（学习写作风格，不要抄袭内容）
${JSON.stringify(mufySample.character, null, 2)}

# 任务要求

生成角色卡数据，包含以下字段：

1. **name**: ${novelData.protagonist.name}
2. **gender**: 根据角色推断（male/female）
3. **age**: 根据角色推断（数字）
4. **tags**: 从小说tags提取，6-8个标签
5. **bio**: 150字内的角色简介，吸引人
6. **persona**: **必须8000-12000字**的完整人设，学习mufy的风格：
   - mufy参考样本的persona有10119字符，你的输出必须达到相似长度
   - 长句、细腻的心理描写、情绪细节
   - 包含：基本信息、外貌、性格、背景故事、行为模式、与玩家关系、情感转变
   - **详细描写各个场景下的反应和心理活动**
   - **不要分段标题**，用自然段落
   - **必须足够长，充分展开每个方面**
7. **opening**: 开场白，500-1000字，带场景感和情绪铺垫
   - 可以用HTML标签（如 <narration>、<span class="a">）
   - 描述初次见面的场景
8. **sampleDialogue**: 示例对话，800-1500字
   - 展示角色的说话风格、语气、用词习惯
   - 可以是具体对话，也可以是文风指南

# 输出格式

严格按照JSON格式输出，不要有任何其他文字：

\`\`\`json
{
  "name": "...",
  "gender": "...",
  "age": ...,
  "tags": [...],
  "bio": "...",
  "persona": "...",
  "opening": "...",
  "sampleDialogue": "..."
}
\`\`\``;

  const stream = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 32000,
    stream: true,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  let responseText = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      responseText += chunk.delta.text;
      process.stdout.write('.');
    }
  }
  console.log('\n');

  // 提取JSON
  let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    // 如果没有找到完整的JSON块，尝试提取不完整的
    jsonMatch = responseText.match(/```json\n([\s\S]*)/);
    if (!jsonMatch) {
      console.error('❌ AI返回格式错误');
      console.log(responseText.substring(0, 1000));
      process.exit(1);
    }
  }

  let jsonStr = jsonMatch[1];

  // 如果JSON不完整，尝试补全
  if (!jsonStr.trim().endsWith('}')) {
    console.log('⚠️  JSON不完整，尝试补全...');
    // 补全 sampleDialogue 和结尾
    if (jsonStr.includes('"sampleDialogue":')) {
      // 找到最后一个完整的引号位置
      const lastQuoteIndex = jsonStr.lastIndexOf('"');
      if (lastQuoteIndex > 0) {
        jsonStr = jsonStr.substring(0, lastQuoteIndex + 1) + '\n}';
      }
    } else {
      jsonStr += '..."\n}';
    }
  }

  const generatedCharacter = JSON.parse(jsonStr);

  // 保存结果
  await mkdir('character-creation-toolkit/generated', { recursive: true });
  const outputPath = `character-creation-toolkit/generated/${generatedCharacter.name}-character.json`;
  await writeFile(outputPath, JSON.stringify(generatedCharacter, null, 2), 'utf-8');

  console.log(`✅ 角色数据已生成: ${outputPath}`);
  console.log('\n📊 数据统计:');
  console.log(`   name: ${generatedCharacter.name}`);
  console.log(`   tags: ${generatedCharacter.tags.join(', ')}`);
  console.log(`   bio: ${generatedCharacter.bio.length} 字符`);
  console.log(`   persona: ${generatedCharacter.persona.length} 字符`);
  console.log(`   opening: ${generatedCharacter.opening.length} 字符`);
  console.log(`   sampleDialogue: ${generatedCharacter.sampleDialogue.length} 字符`);

  process.exit(0);
}

main().catch(console.error);
