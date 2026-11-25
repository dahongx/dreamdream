#!/usr/bin/env bun
/**
 * 分步生成美化包 - Step 2: 演绎室组件HTML
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile } from 'fs/promises';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  console.log('📖 读取参考样本...');
  const sample1 = JSON.parse(
    await readFile('character-creation-toolkit/beautification-library/方鹤之.json', 'utf-8')
  );

  console.log('📖 读取角色信息...');
  const character = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-character.json', 'utf-8')
  );

  const prompt = `你是前端开发者，要为现言总裁"沈亦寒"创作演绎室组件。

# 角色信息
- 名字: ${character.name}
- Bio: ${character.bio}
- 关键场景：
  1. 离婚当天（冷漠签字，内心崩溃）
  2. 离婚后追妻（卑微守候，深夜等待）
  3. 商战霸道（会议室冷酷，谈判桌强势）
  4. 偏执深情（只认定你一人，偏执到病态）

# 参考样本组件（学习结构，不要照抄）
${sample1.components[0]?.content?.substring(0, 2000) || ''}
...（省略）

# 二次创作要求

**改编思路：**
1. 保留：折叠面板结构、状态栏、进度条的**概念**
2. 修改：
   - 布局：从上下改成左右，或网格布局
   - 场景：古风场景→现代商务场景
   - 类名：bamboo/tea→corporate/steel
   - 配色：#485F88 + #2C3E50 + #D4AF37
   - 图标：古风图标→现代商务图标（briefcase, chart-line, building等）
   - 文案：展示沈亦寒的4个关键场景

输出完整HTML（1000-2000行）：

\`\`\`html
<div class="shen-yihan-theater">
  <!-- 你的改编内容 -->
</div>
\`\`\``;

  console.log('\n🤖 生成演绎室组件...');

  const stream = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 32000,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  });

  let response = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      response += chunk.delta.text;
      process.stdout.write('.');
    }
  }
  console.log('\n');

  // 提取HTML
  const htmlMatch = response.match(/```html\n([\s\S]*?)\n```/);
  const html = htmlMatch ? htmlMatch[1] : response;

  await writeFile('character-creation-toolkit/generated/沈亦寒-component.html', html, 'utf-8');

  console.log(`✅ 组件HTML已生成: ${html.length} 字符`);
  console.log('保存到: 沈亦寒-component.html');

  // 合并成完整美化包
  const globalCss = await readFile('character-creation-toolkit/generated/沈亦寒-globalcss.txt', 'utf-8');

  const beautificationPack = {
    name: `${character.name}的美化包（v3-改编版）`,
    globalCss: globalCss,
    components: [
      {
        name: '关键场景',
        htmlContent: html,
      },
    ],
  };

  await writeFile(
    `character-creation-toolkit/generated/${character.name}-beautification-v3-final.json`,
    JSON.stringify(beautificationPack, null, 2),
    'utf-8'
  );

  console.log(`\n✅ 完整美化包已生成:`);
  console.log(`   GlobalCSS: ${globalCss.length} 字符`);
  console.log(`   组件HTML: ${html.length} 字符`);
  console.log(`   文件: ${character.name}-beautification-v3-final.json`);

  process.exit(0);
}

main().catch(console.error);
