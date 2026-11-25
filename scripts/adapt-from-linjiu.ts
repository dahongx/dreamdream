#!/usr/bin/env bun
/**
 * 以林久深为基底，改编成沈亦寒的美化包
 */

import { readFile, writeFile } from 'fs/promises';

async function main() {
  console.log('📖 读取林久深美化包...');
  const linJiushen = JSON.parse(
    await readFile('character-creation-toolkit/beautification-library/林久深.json', 'utf-8')
  );

  console.log('📖 读取沈亦寒角色信息...');
  const character = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-character.json', 'utf-8')
  );

  console.log('\n🎨 开始改编...');

  // Step 1: 改编 GlobalCSS
  let newGlobalCss = linJiushen.globalCss;

  // 颜色替换（简单字符串替换，不用正则）
  const colorReplacements = [
    ['#1a1612', '#2C3E50'], // 深棕 → 商务深灰
    ['#2d2620', '#34495E'], // 中棕 → 商务灰
    ['#3d3630', '#485F88'], // 浅棕 → 商务蓝
    ['#f5deb3', '#E8EAF6'], // 米色 → 浅蓝灰
    ['rgba(61, 54, 48, 0.95)', 'rgba(72, 95, 136, 0.95)'],
    ['rgba(61, 54, 48, 0.9)', 'rgba(72, 95, 136, 0.9)'],
    ['rgba(45, 38, 32, 0.9)', 'rgba(44, 62, 80, 0.9)'],
  ];

  for (const [oldColor, newColor] of colorReplacements) {
    newGlobalCss = newGlobalCss.replaceAll(oldColor, newColor);
  }

  // 变量名替换
  newGlobalCss = newGlobalCss.replace(/gallery-gold/g, 'corporate-gold');
  newGlobalCss = newGlobalCss.replace(/gallery-dark/g, 'corporate-dark');
  newGlobalCss = newGlobalCss.replace(/gallery-brown/g, 'corporate-blue');
  newGlobalCss = newGlobalCss.replace(/gallery-light/g, 'corporate-light');

  // 主题名替换
  newGlobalCss = newGlobalCss.replace(/林久深 - 画廊主题/g, '沈亦寒 - 商战主题');
  newGlobalCss = newGlobalCss.replace(/Gallery Theme/g, 'Corporate Theme');

  console.log(`✅ GlobalCSS 改编完成: ${newGlobalCss.length} 字符`);

  // Step 2: 改编组件HTML
  let newComponentHtml = linJiushen.components[0]?.content || '';

  // 颜色替换
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    newComponentHtml = newComponentHtml.replace(new RegExp(oldColor, 'gi'), newColor);
  }

  // 内容替换（画廊场景 → 商战场景）
  newComponentHtml = newComponentHtml.replace(/画廊/g, '盛世集团');
  newComponentHtml = newComponentHtml.replace(/艺术品/g, '商战项目');
  newComponentHtml = newComponentHtml.replace(/展览/g, '会议');
  newComponentHtml = newComponentHtml.replace(/Gallery/gi, 'Corporate');
  newComponentHtml = newComponentHtml.replace(/林久深/g, character.name);

  console.log(`✅ 组件HTML 改编完成: ${newComponentHtml.length} 字符`);

  // Step 3: 组装完整美化包
  const beautificationPack = {
    name: `${character.name}的美化包（改编自林久深）`,
    globalCss: newGlobalCss,
    components: [
      {
        name: '商战场景',
        htmlContent: newComponentHtml,
      },
    ],
  };

  const outputPath = `character-creation-toolkit/generated/${character.name}-beautification-v4.json`;
  await writeFile(outputPath, JSON.stringify(beautificationPack, null, 2), 'utf-8');

  console.log(`\n✅ 美化包已生成: ${outputPath}`);
  console.log(`   GlobalCSS: ${newGlobalCss.length} 字符`);
  console.log(`   组件HTML: ${newComponentHtml.length} 字符`);
  console.log('\n📝 改编内容：');
  console.log('   - 配色：画廊金棕 → 商务蓝灰金');
  console.log('   - 变量名：gallery → corporate');
  console.log('   - 场景：画廊艺术 → 商战会议');
  console.log('   - 角色名：林久深 → 沈亦寒');
}

main().catch(console.error);
