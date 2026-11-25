#!/usr/bin/env bun
/**
 * 分析素材库中的现言风格角色
 */

import { readFile, readdir, writeFile } from 'fs/promises';

async function main() {
  const libraryDir = 'character-creation-toolkit/beautification-library';
  const files = await readdir(libraryDir);

  console.log('🔍 分析所有角色的标签和风格...\n');

  const modernRomance = []; // 现言
  const ancient = []; // 古言
  const others = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    try {
      const data = JSON.parse(
        await readFile(`${libraryDir}/${file}`, 'utf-8')
      );

      if (!data.usedBy || data.usedBy.length === 0) continue;

      const charName = data.usedBy[0];

      // 通过关键词判断类型
      const cssContent = data.globalCss?.toLowerCase() || '';
      const componentContent = data.components?.[0]?.content?.toLowerCase() || '';
      const allContent = cssContent + componentContent;

      // 古风特征：茶韵、墨韵、竹、宋体、古风
      const isAncient =
        allContent.includes('茶韵') ||
        allContent.includes('墨韵') ||
        allContent.includes('古风') ||
        allContent.includes('宋体') ||
        allContent.includes('jinghua');

      // 现代特征：现代、商务、都市
      const isModern =
        allContent.includes('现代') ||
        allContent.includes('商务') ||
        allContent.includes('都市') ||
        allContent.includes('corporate');

      const info = {
        name: charName,
        file: file,
        hasGlobalCss: !!data.globalCss,
        hasComponent: data.components?.length > 0,
        globalCssLength: data.globalCss?.length || 0,
        componentLength: data.components?.[0]?.content?.length || 0,
      };

      if (isAncient) {
        ancient.push(info);
      } else if (isModern) {
        modernRomance.push(info);
      } else if (info.globalCssLength > 1000 || info.componentLength > 1000) {
        // 有实质内容但没有明显特征的
        others.push(info);
      }
    } catch (e) {
      // 跳过无效文件
    }
  }

  console.log('📊 统计结果：');
  console.log(`   古言角色: ${ancient.length} 个`);
  console.log(`   现言角色: ${modernRomance.length} 个`);
  console.log(`   其他有美化的: ${others.length} 个\n`);

  console.log('🏛️ 古言风格角色（前10个）：');
  ancient.slice(0, 10).forEach((char, i) => {
    console.log(`   ${i + 1}. ${char.name} - CSS:${char.globalCssLength} / 组件:${char.componentLength}`);
  });

  console.log('\n🏙️ 现言风格角色：');
  if (modernRomance.length > 0) {
    modernRomance.forEach((char, i) => {
      console.log(`   ${i + 1}. ${char.name} - CSS:${char.globalCssLength} / 组件:${char.componentLength}`);
    });
  } else {
    console.log('   未找到明确标记为现言的角色');
  }

  console.log('\n🎨 其他有完整美化的角色（前15个）：');
  others.slice(0, 15).forEach((char, i) => {
    console.log(`   ${i + 1}. ${char.name} - CSS:${char.globalCssLength} / 组件:${char.componentLength}`);
  });

  // 保存分析结果
  const report = {
    ancient: ancient,
    modernRomance: modernRomance,
    others: others,
  };

  await writeFile(
    'character-creation-toolkit/beautification-analysis.json',
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  console.log('\n✅ 分析完成，结果已保存到 beautification-analysis.json');
}

main().catch(console.error);
