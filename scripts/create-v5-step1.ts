#!/usr/bin/env bun
/**
 * 综合分析精美卡，提取设计精华，为沈亦寒创作美化
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile } from 'fs/promises';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  console.log('📖 读取精美卡样本...');

  // 读取3个最精美的卡
  const samples = [];
  for (const name of ['宫江野', 'Oliver', '权时焕']) {
    const data = JSON.parse(
      await readFile(`character-creation-toolkit/beautification-library/${name}.json`, 'utf-8')
    );
    samples.push({
      name,
      globalCss: data.globalCss?.substring(0, 8000) || '', // 只取前8000字符
      component: data.components?.[0]?.content?.substring(0, 10000) || '', // 只取前10000字符
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

  const prompt = `你是顶级UI设计师，要为现言总裁"沈亦寒"创作**眼前一亮**的美化包。

# 角色信息
- 名字: ${character.name}
- 类型: 现言总裁追妻火葬场
- Bio: ${character.bio}
- 关键场景: ${JSON.stringify(novel.keyScenes, null, 2)}

# 精美卡参考样本

## 样本1: ${samples[0].name}
GlobalCSS片段:
${samples[0].globalCss}

组件片段:
${samples[0].component}

## 样本2: ${samples[1].name}
GlobalCSS片段:
${samples[1].globalCss}

组件片段:
${samples[1].component}

## 样本3: ${samples[2].name}
GlobalCSS片段:
${samples[2].globalCss}

组件片段:
${samples[2].component}

---

# 任务要求

## 设计目标：眼前一亮！

必须做到：
1. **视觉冲击力** - 不是简单的方框，要有层次感
2. **精致细节** - 毛玻璃、渐变、阴影、动画都要有
3. **氛围营造** - 现代商战的冷峻、奢华、权力感
4. **东拼西凑精华** - 学习3个样本的最佳设计手法

## 具体要求

### GlobalCSS（输出完整CSS，15000-20000字符）

学习样本的设计手法，改编为商战风格：
- **配色**：商务蓝#485F88 + 深灰#2C3E50 + 金色#D4AF37
- **保留精华**：
  - 毛玻璃效果（backdrop-filter）
  - 渐变背景
  - 精致的边框和圆角
  - 悬浮阴影
  - 动画过渡
- **改编点**：
  - 古风色→现代商务色
  - 古风字体→现代无衬线
  - 变量名改成corporate/steel相关

### 演绎室组件HTML（输出完整HTML，20000-30000字符）

学习样本的布局结构，创作商战场景：
- **保留结构**：
  - 如果样本有浮动导航球，保留
  - 如果样本有折叠面板，保留
  - 如果样本有状态栏，保留
  - 如果样本有卡片布局，保留
- **改编内容**：
  - 古风场景→现代商战场景（离婚当天、深夜追妻、会议室冷酷、偏执守候）
  - 古风装饰→现代几何线条/建筑剪影
  - 人物名→沈亦寒

## 输出格式

分两次输出：

第一次输出GlobalCSS：
\`\`\`css
<style>
/* 沈亦寒 - 商战主题 */
...（完整CSS，15000-20000字符）
</style>
\`\`\`

等我确认后，第二次输出组件HTML。`;

  console.log('\n🤖 AI创作GlobalCSS...');

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

  // 提取CSS
  const cssMatch = response.match(/```(?:css)?\n(<style>[\s\S]*?<\/style>)\n```/);
  let globalCss = cssMatch ? cssMatch[1] : response;

  if (!globalCss.includes('<style>')) {
    globalCss = '<style>\n' + globalCss + '\n</style>';
  }

  await writeFile('character-creation-toolkit/generated/沈亦寒-v5-globalcss.txt', globalCss, 'utf-8');

  console.log(`✅ GlobalCSS已生成: ${globalCss.length} 字符`);
  console.log('   保存到: 沈亦寒-v5-globalcss.txt');
  console.log('\n⏸️  请检查CSS质量，如果满意，运行第2步生成组件HTML');
}

main().catch(console.error);
