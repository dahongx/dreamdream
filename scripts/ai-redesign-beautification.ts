#!/usr/bin/env bun
/**
 * AI二次创作美化包 - 真正的改编，不是抄袭
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, readdir } from 'fs/promises';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  console.log('📖 读取角色信息...');
  const character = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-character.json', 'utf-8')
  );

  console.log('📖 读取素材库...');
  const libraryFiles = await readdir('character-creation-toolkit/beautification-library');

  // 随机选3个不同风格的作为参考
  const samples = [];
  for (const file of ['方鹤之.json', '陆予觉.json', '周予安.json']) {
    try {
      const data = JSON.parse(
        await readFile(`character-creation-toolkit/beautification-library/${file}`, 'utf-8')
      );
      samples.push({ name: file.replace('.json', ''), ...data });
    } catch (e) {
      console.log(`跳过 ${file}`);
    }
  }

  console.log(`✅ 加载了 ${samples.length} 个参考样本`);

  const prompt = `你是UI设计师，要为现言总裁角色"沈亦寒"创作美化包。

# 角色信息
- 名字: ${character.name}
- 类型: 现言总裁追妻火葬场
- 关键词: 商战、偏执、冷面深情、先婚后爱

# 设计要求

**重要：这是二次创作，不是抄袭！**

参考${samples.length}个样本的**思路和结构**，但必须：
1. **换方向** - 布局从上到下改成左到右，或反之
2. **换颜色** - 现言蓝 #485F88 + 商务灰 #2C3E50 + 金色点缀 #D4AF37
3. **换字体** - 不用古风字体，用现代商务字体
4. **换元素** - 把古风元素改成现代商务元素（水墨纹理→几何线条，竹叶→建筑剪影）
5. **换顺序** - 打乱组件顺序，重新组织信息层级
6. **增删内容** - 根据沈亦寒人设增删场景

# 参考样本（学习结构，不要照抄）

${samples.map((s, i) => `
## 样本${i + 1}: ${s.name}
GlobalCSS片段:
${s.globalCss?.substring(0, 1000)}...

组件结构:
${s.components?.map(c => `- ${c.name}: ${c.content?.substring(0, 200)}...`).join('\n')}
`).join('\n')}

# 输出要求

1. **GlobalCSS** - 完整的全局样式（3000-5000行）
   - 主题色系统
   - 按钮、输入框、卡片样式
   - 动画效果
   - 不要出现"茶韵"、"墨韵"等古风词汇

2. **演绎室组件HTML** - 完整的组件（1000-2000行）
   - 展示沈亦寒的关键场景（离婚后悔、追妻卑微、商战霸道、深情偏执）
   - 现代商务风格
   - 交互效果（折叠、hover、动画）

输出格式：

\`\`\`json
{
  "globalCss": "...",
  "componentHtml": "..."
}
\`\`\``;

  console.log('\n🤖 AI二次创作中...');

  const stream = await client.messages.create({
    model: 'claude-sonnet-5',
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

  // 提取JSON
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    console.error('❌ 未找到JSON输出');
    await writeFile('character-creation-toolkit/generated/debug-beautification-v3.txt', response, 'utf-8');
    console.log('已保存调试文件: debug-beautification-v3.txt');
    process.exit(1);
  }

  const result = JSON.parse(jsonMatch[1]);

  const beautificationPack = {
    name: `${character.name}的美化包（v3）`,
    globalCss: result.globalCss,
    components: [
      {
        name: '关键场景',
        htmlContent: result.componentHtml,
      },
    ],
  };

  const outputPath = `character-creation-toolkit/generated/${character.name}-beautification-v3.json`;
  await writeFile(outputPath, JSON.stringify(beautificationPack, null, 2), 'utf-8');

  console.log(`✅ 美化包已生成: ${outputPath}`);
  console.log(`   GlobalCSS: ${beautificationPack.globalCss.length} 字符`);
  console.log(`   组件HTML: ${beautificationPack.components[0].htmlContent.length} 字符`);

  process.exit(0);
}

main().catch(console.error);
