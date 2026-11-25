#!/usr/bin/env bun
/**
 * 为生成的角色创建美化包
 * 策略：复用mufy美化包，只改主题色和文案
 */

import { readFile, writeFile } from 'fs/promises';

async function main() {
  console.log('📖 读取生成的角色数据...');
  const character = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-character.json', 'utf-8')
  );

  console.log('📖 读取mufy美化包样本...');
  const mufySample = JSON.parse(
    await readFile('character-creation-toolkit/mufy-samples/方鹤之.json', 'utf-8')
  );

  const mufyPack = mufySample.beautification;

  console.log('🎨 创建新美化包...');

  // 主题色映射
  const themeColors = {
    古言: '#B49B7F', // 方鹤之原色
    现言: '#485F88',
    校园: '#EC4899',
  };

  const genre = '现言'; // 沈亦寒是现言总裁
  const newThemeColor = themeColors[genre];
  const oldThemeColor = '#B49B7F'; // 方鹤之的主题色

  // 1. 复制globalCss，替换主题色
  let newGlobalCss = mufyPack.globalCss;
  newGlobalCss = newGlobalCss.replace(new RegExp(oldThemeColor, 'g'), newThemeColor);
  newGlobalCss = newGlobalCss.replace(/方鹤之/g, character.name);

  // 2. 复制组件（暂时保留mufy的，只改角色名和占位符）
  const newComponents = mufyPack.components.map((comp: any) => {
    let html = comp.htmlContent || '';

    // 替换角色名
    html = html.replace(/方鹤之/g, character.name);

    // 替换图片为占位符
    html = html.replace(/src="[^"]*"/g, 'src="https://placehold.co/600x400/EEE/999?text=Image+Placeholder"');

    return {
      name: comp.name.replace(/方鹤之/g, character.name),
      htmlContent: html,
      cssScope: comp.cssScope,
      runtime: comp.runtime,
    };
  });

  // 3. 组装美化包
  const beautificationPack = {
    name: `${character.name} 的美化包`,
    globalCss: newGlobalCss,
    components: newComponents,
  };

  // 4. 保存
  const outputPath = `character-creation-toolkit/generated/${character.name}-beautification.json`;
  await writeFile(outputPath, JSON.stringify(beautificationPack, null, 2), 'utf-8');

  console.log(`✅ 美化包已生成: ${outputPath}`);
  console.log('\n📊 美化包统计:');
  console.log(`   globalCss: ${beautificationPack.globalCss.length} 字符`);
  console.log(`   组件数: ${beautificationPack.components.length}`);
  console.log(`   主题色: ${newThemeColor} (${genre})`);

  // 5. 合并到完整角色数据
  const fullCharacter = {
    character: character,
    beautification: beautificationPack,
  };

  const fullOutputPath = `character-creation-toolkit/generated/${character.name}-complete.json`;
  await writeFile(fullOutputPath, JSON.stringify(fullCharacter, null, 2), 'utf-8');

  console.log(`✅ 完整角色数据: ${fullOutputPath}`);

  process.exit(0);
}

main().catch(console.error);
