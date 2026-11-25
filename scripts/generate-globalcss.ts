#!/usr/bin/env bun
/**
 * 分步生成美化包 - Step 1: GlobalCSS
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

  const prompt = `你是CSS专家，要为现言总裁角色"沈亦寒"创作GlobalCSS。

# 角色信息
- 名字: 沈亦寒
- 类型: 现言总裁追妻火葬场
- 配色: 商战蓝#485F88 + 深灰#2C3E50 + 金色#D4AF37

# 参考样本GlobalCSS（学习结构，不要照抄）
${sample1.globalCss.substring(0, 2000)}
...（省略）

# 二次创作要求

**改编思路（不是抄袭）：**
1. 保留：CSS变量系统、按钮样式、卡片样式、动画效果的**结构**
2. 修改：
   - 颜色：古风茶色→现代商务蓝灰金
   - 字体：古风宋体→现代无衬线字体
   - 元素名：tea/bamboo→corporate/steel
   - 注释：去掉"茶韵"、"墨韵"等古风词
   - 边框：圆润→硬朗直角
   - 阴影：柔和→锐利
   - 动画：缓慢优雅→快速干脆

输出完整CSS（<style>标签包裹，3000-5000行）：

\`\`\`css
<style>
/* 沈亦寒美化包 - 冷峻商务风 */
...
</style>
\`\`\``;

  console.log('\n🤖 生成GlobalCSS...');

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

  // 提取CSS
  const cssMatch = response.match(/```(?:css)?\n(<style>[\s\S]*?<\/style>)\n```/);
  let css = cssMatch ? cssMatch[1] : response;

  // 如果没有<style>标签，添加
  if (!css.includes('<style>')) {
    css = '<style>\n' + css + '\n</style>';
  }

  await writeFile('character-creation-toolkit/generated/沈亦寒-globalcss.txt', css, 'utf-8');

  console.log(`✅ GlobalCSS已生成: ${css.length} 字符`);
  console.log('保存到: 沈亦寒-globalcss.txt');

  process.exit(0);
}

main().catch(console.error);
