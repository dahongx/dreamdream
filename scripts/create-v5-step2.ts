#!/usr/bin/env bun
/**
 * 综合创作v5美化包 - Step 2: 组件HTML
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile } from 'fs/promises';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  console.log('📖 读取精美卡样本...');

  const samples = [];
  for (const name of ['宫江野', 'Oliver', '权时焕']) {
    const data = JSON.parse(
      await readFile(`character-creation-toolkit/beautification-library/${name}.json`, 'utf-8')
    );
    samples.push({
      name,
      component: data.components?.[0]?.content?.substring(0, 15000) || '',
    });
  }

  console.log('📖 读取沈亦寒角色信息...');
  const character = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-character.json', 'utf-8')
  );

  console.log('📖 读取小说素材...');
  const novel = JSON.parse(
    await readFile('character-creation-toolkit/test-novel-ceo.json', 'utf-8')
  );

  const prompt = `你是顶级UI设计师，继续为现言总裁"沈亦寒"创作演绎室组件HTML。

# 角色信息
- 名字: ${character.name}
- Bio: ${character.bio}
- 关键场景:
  1. 离婚当天：民政局，冷漠签字，内心崩溃
  2. 深夜守候：你家楼下，他的车里，卑微等待
  3. 会议室冷酷：商战谈判，冷面总裁，杀伐决断
  4. 偏执深情：只认定你一人，偏执到病态

# 精美卡组件参考

## 样本1: ${samples[0].name}
${samples[0].component}

## 样本2: ${samples[1].name}
${samples[1].component}

## 样本3: ${samples[2].name}
${samples[2].component}

---

# 任务要求

创作演绎室组件HTML，展示沈亦寒的4个关键场景。

## 必须做到：

1. **东拼西凑精华**：
   - 如果样本有浮动导航球，借鉴它
   - 如果样本有折叠面板，借鉴它
   - 如果样本有卡片布局，借鉴它
   - 如果样本有状态栏/进度条，借鉴它

2. **改编不抄袭**：
   - 保留结构和设计手法
   - 改配色：商务蓝#485F88 + 深灰#2C3E50 + 金色#D4AF37
   - 改内容：古风→现代商战
   - 改类名：避免冲突

3. **视觉冲击力**：
   - 精致的卡片（圆角、阴影、渐变）
   - 动画效果（hover、展开、过渡）
   - 装饰元素（分隔线、图标、徽章）
   - 层次感（背景层、内容层、装饰层）

4. **内容要丰富**：
   - 4个场景都要详细展示
   - 每个场景有描述、标签、情绪状态
   - 有人物卡片（头像、职位、状态）
   - 有互动元素（可折叠、可点击）

## 输出完整HTML（20000-30000字符）：

\`\`\`html
<div class="shen-yihan-theater">
  <!-- 你的创作 -->
</div>
\`\`\``;

  console.log('\n🤖 AI创作组件HTML...');

  const stream = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 64000,
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
  const componentHtml = htmlMatch ? htmlMatch[1] : response;

  await writeFile('character-creation-toolkit/generated/沈亦寒-v5-component.html', componentHtml, 'utf-8');

  console.log(`✅ 组件HTML已生成: ${componentHtml.length} 字符`);

  // 合并成完整美化包
  const globalCss = await readFile('character-creation-toolkit/generated/沈亦寒-v5-globalcss.txt', 'utf-8');

  const beautificationPack = {
    name: `${character.name}的美化包（v5-精品综合版）`,
    globalCss: globalCss,
    components: [
      {
        name: '商战场景',
        htmlContent: componentHtml,
      },
    ],
  };

  await writeFile(
    `character-creation-toolkit/generated/${character.name}-beautification-v5.json`,
    JSON.stringify(beautificationPack, null, 2),
    'utf-8'
  );

  console.log(`\n✅ 完整美化包已生成:`);
  console.log(`   GlobalCSS: ${globalCss.length} 字符`);
  console.log(`   组件HTML: ${componentHtml.length} 字符`);
  console.log(`   文件: ${character.name}-beautification-v5.json`);
  console.log('\n🎨 综合了宫江野、Oliver、权时焕的设计精华');
}

main().catch(console.error);
