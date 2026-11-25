#!/usr/bin/env bun
/**
 * AI改写美化包 - 让它看起来不一样
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile } from 'fs/promises';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  console.log('📖 读取mufy美化包样本...');
  const mufySample = JSON.parse(
    await readFile('character-creation-toolkit/mufy-samples/方鹤之-complete.json', 'utf-8')
  );

  console.log('📖 读取角色信息...');
  const character = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-character.json', 'utf-8')
  );

  console.log('📖 读取小说素材...');
  const novelData = JSON.parse(
    await readFile('character-creation-toolkit/test-novel-ceo.json', 'utf-8')
  );

  const mufyComponent = mufySample.beautification.components[0];

  console.log('\n🤖 Step 1: AI改写演绎室组件...');

  const componentPrompt = `你是前端开发者，要基于参考模板改写一个演绎室组件。

# 参考模板（学习结构，不要直接抄）
${mufyComponent.content.substring(0, 3000)}
...（省略）

# 新角色信息
- 角色名: ${character.name}
- 类型: 现言总裁追妻火葬场
- 关键场景: ${JSON.stringify(novelData.keyScenes, null, 2)}

# 任务

改写演绎室组件HTML：
1. **结构可以参考**：折叠面板、状态栏、进度条等
2. **但必须改变**：
   - 变量名（改类名、ID）
   - 文案内容（换成沈亦寒的场景）
   - 样式细节（调整颜色、间距、动画）
3. **内容要求**：
   - 展示${character.name}的关键场景
   - 3-5个折叠面板，每个对应一个场景
   - 主题色：#485F88（现言蓝）
4. **不要出现**："方鹤之"、"墨韵"、"茶韵"等mufy特征词

输出完整HTML（500-1000行）：

\`\`\`html
<div class="custom-演绎室">
  <!-- 你的改写内容 -->
</div>
\`\`\``;

  const stream1 = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 16000,
    stream: true,
    messages: [{ role: 'user', content: componentPrompt }],
  });

  let componentHtml = '';
  for await (const chunk of stream1) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      componentHtml += chunk.delta.text;
      process.stdout.write('.');
    }
  }
  console.log('\n');

  // 提取HTML
  const htmlMatch = componentHtml.match(/```html\n([\s\S]*?)\n```/);
  const finalHtml = htmlMatch ? htmlMatch[1] : componentHtml;

  console.log(`✅ 组件HTML生成: ${finalHtml.length} 字符`);

  // 保存
  const beautificationPack = {
    name: `${character.name}的美化包`,
    globalCss: mufySample.beautification.globalCss
      .replace(/#B49B7F/g, '#485F88')
      .replace(/方鹤之/g, character.name)
      .replace(/雅宋茶韵/g, '现代商战')
      .replace(/墨韵幽篁/g, '都市霓虹'),
    components: [
      {
        name: '关键场景',
        htmlContent: finalHtml,
      },
    ],
  };

  const outputPath = `character-creation-toolkit/generated/${character.name}-beautification-v2.json`;
  await writeFile(outputPath, JSON.stringify(beautificationPack, null, 2), 'utf-8');

  console.log(`✅ 美化包已生成: ${outputPath}`);

  process.exit(0);
}

main().catch(console.error);
