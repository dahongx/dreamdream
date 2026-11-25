#!/usr/bin/env bun
/**
 * AI生成角色卡 - 分步生成版本
 *
 * Step 1: 生成基础信息 + persona
 * Step 2: 生成opening + sampleDialogue
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, mkdir } from 'fs/promises';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generatePersona(novelData: any, mufySample: any) {
  console.log('🤖 Step 1: 生成基础信息和persona...');

  const prompt = `你是一个专业的角色卡创作者。基于小说素材生成角色的基础信息和persona。

# 小说素材
${JSON.stringify(novelData, null, 2)}

# mufy风格参考
${JSON.stringify({ name: mufySample.character.name, persona: mufySample.character.persona.substring(0, 3000) + '...' }, null, 2)}

# 任务

生成以下内容：

1. name: ${novelData.protagonist.name}
2. gender: male/female
3. age: 数字
4. tags: 6-8个标签数组
5. bio: 150字内简介
6. persona: **10000字以上**的完整人设
   - 参考mufy样本有10119字，你的输出应该达到类似长度
   - 学习mufy的长句风格、心理描写、情绪细节
   - 包含：基本信息、外貌、性格、背景故事、行为模式、与玩家关系、情感转变、各种场景下的反应
   - 必须充分详细地展开每个方面

输出JSON：

\`\`\`json
{
  "name": "...",
  "gender": "...",
  "age": ...,
  "tags": [...],
  "bio": "...",
  "persona": "..."
}
\`\`\``;

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

  // 尝试提取JSON，允许不完整
  let jsonMatch = responseText.match(/```json\n([\s\S]*)/);
  if (!jsonMatch) {
    console.log('⚠️  无法提取JSON');
    throw new Error('无法提取JSON');
  }

  let jsonStr = jsonMatch[1].replace(/```$/, '').trim();

  // 修复：persona字段里的真实换行符在JSON中不合法
  // 需要找到 "persona": "..." 并将其中的真实换行替换为 \\n
  const personaRegex = /("persona":\s*")([^]*?)(")/;
  jsonStr = jsonStr.replace(personaRegex, (match, prefix, content, suffix) => {
    // 将真实换行符替换为 \\n
    const fixed = content.replace(/\n/g, '\\n').replace(/\r/g, '');
    return prefix + fixed + suffix;
  });

  // 如果JSON不完整，尝试修复
  if (!jsonStr.endsWith('}')) {
    console.log('⚠️  JSON不完整，尝试修复...');

    // 找到 "persona": " 的位置
    const personaMatch = jsonStr.match(/"persona":\s*"/);
    if (personaMatch && personaMatch.index !== undefined) {
      const personaStart = personaMatch.index + personaMatch[0].length;
      const afterPersona = jsonStr.substring(personaStart);

      // 找到最后一个完整的段落结尾（。\n\n 或者 。" ）
      let cutPoint = -1;

      // 优先找 。"\n} 这种完整结束
      const completeEnd = afterPersona.lastIndexOf('。"\n}');
      if (completeEnd > 0) {
        cutPoint = completeEnd + 2; // 包含 。"
      } else {
        // 否则找最后一个 。 加上段落结束
        const sentences = afterPersona.split('。');
        if (sentences.length > 1) {
          // 去掉最后一个不完整的句子
          const completePart = sentences.slice(0, -1).join('。') + '。';
          cutPoint = completePart.length;
        }
      }

      if (cutPoint > 0) {
        const completePersona = afterPersona.substring(0, cutPoint);
        const beforePersona = jsonStr.substring(0, personaStart);
        jsonStr = beforePersona + completePersona + '"\n}';
      } else {
        // 实在找不到，就截取到最后的引号
        const lastQuote = jsonStr.lastIndexOf('"');
        if (lastQuote > personaStart) {
          jsonStr = jsonStr.substring(0, lastQuote) + '"\n}';
        }
      }
    }
  }

  console.log(`📏 JSON长度: ${jsonStr.length} 字符`);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('❌ JSON解析失败，保存到临时文件...');
    await writeFile('character-creation-toolkit/generated/debug-persona.json', jsonStr, 'utf-8');
    console.log('已保存到: character-creation-toolkit/generated/debug-persona.json');
    throw e;
  }
}

async function generateDialogues(baseData: any, novelData: any) {
  console.log('🤖 Step 2: 生成opening和sampleDialogue...');

  const prompt = `基于角色信息生成开场白和示例对话。

# 角色信息
- 名字: ${baseData.name}
- 性格: ${baseData.tags.join(', ')}
- 简介: ${baseData.bio}

# 小说场景
${JSON.stringify(novelData.keyScenes, null, 2)}

# 任务

生成：

1. opening: 500-1000字开场白
   - 描述初次见面场景
   - 可用HTML标签：<narration>、<span class="a">

2. sampleDialogue: 800-1500字示例对话
   - 展示说话风格和语气

输出JSON：

\`\`\`json
{
  "opening": "...",
  "sampleDialogue": "..."
}
\`\`\``;

  const stream = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
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

  const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('无法提取JSON');
  }

  return JSON.parse(jsonMatch[1]);
}

async function main() {
  console.log('📖 读取小说素材...');
  const novelData = JSON.parse(
    await readFile('character-creation-toolkit/test-novel-ceo.json', 'utf-8')
  );

  console.log('📖 读取mufy样本...');
  const mufySample = JSON.parse(
    await readFile('character-creation-toolkit/mufy-samples/方鹤之.json', 'utf-8')
  );

  // Step 1: 生成基础信息和persona
  const baseData = await generatePersona(novelData, mufySample);

  // Step 2: 生成opening和sampleDialogue
  const dialogues = await generateDialogues(baseData, novelData);

  // 合并
  const finalData = { ...baseData, ...dialogues };

  // 保存
  await mkdir('character-creation-toolkit/generated', { recursive: true });
  const outputPath = `character-creation-toolkit/generated/${finalData.name}-character.json`;
  await writeFile(outputPath, JSON.stringify(finalData, null, 2), 'utf-8');

  console.log(`✅ 角色数据已生成: ${outputPath}`);
  console.log('\n📊 数据统计:');
  console.log(`   name: ${finalData.name}`);
  console.log(`   tags: ${finalData.tags.join(', ')}`);
  console.log(`   bio: ${finalData.bio.length} 字符`);
  console.log(`   persona: ${finalData.persona.length} 字符`);
  console.log(`   opening: ${finalData.opening.length} 字符`);
  console.log(`   sampleDialogue: ${finalData.sampleDialogue.length} 字符`);

  process.exit(0);
}

main().catch(console.error);
