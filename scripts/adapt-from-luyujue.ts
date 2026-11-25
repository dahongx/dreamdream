#!/usr/bin/env bun
/**
 * 以陆予觉为基底，稍微改编成沈亦寒版本
 */

import { readFile, writeFile } from 'fs/promises';

async function main() {
  console.log('📖 读取陆予觉美化包...');
  const luyujue = JSON.parse(
    await readFile('character-creation-toolkit/beautification-library/陆予觉.json', 'utf-8')
  );

  console.log('📖 读取沈亦寒角色信息...');
  const character = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-character.json', 'utf-8')
  );

  console.log('\n🎨 开始改编（小幅度）...');

  // Step 1: 改编 GlobalCSS（只改颜色变量和注释）
  let newGlobalCss = luyujue.globalCss;

  // 改注释和变量名
  newGlobalCss = newGlobalCss.replace(/陆予觉/g, character.name);
  newGlobalCss = newGlobalCss.replace(/影帝/g, '总裁');
  newGlobalCss = newGlobalCss.replace(/联姻/g, '商战');

  // 微调主题色（保持优雅，只稍微调整色调）
  // 假设陆予觉用的是某种配色，我们微调成商务风格
  // 这里需要看具体的CSS变量，暂时先不动颜色

  console.log(`✅ GlobalCSS 改编完成: ${newGlobalCss.length} 字符`);

  // Step 2: 改编组件HTML（只改文案）
  let newComponentHtml = luyujue.components[0]?.content || '';

  // 改人名
  newComponentHtml = newComponentHtml.replace(/陆予觉/g, character.name);

  // 改场景相关的词
  newComponentHtml = newComponentHtml.replace(/影帝/g, '总裁');
  newComponentHtml = newComponentHtml.replace(/对家/g, '对手');
  newComponentHtml = newComponentHtml.replace(/联姻/g, '联姻');
  newComponentHtml = newComponentHtml.replace(/娱乐圈/g, '商界');
  newComponentHtml = newComponentHtml.replace(/拍戏/g, '谈判');
  newComponentHtml = newComponentHtml.replace(/片场/g, '会议室');

  // 改类名前缀（避免冲突）
  newComponentHtml = newComponentHtml.replace(/luyujue-/g, 'shenyihan-');
  newComponentHtml = newComponentHtml.replace(/lyj-/g, 'syh-');

  console.log(`✅ 组件HTML 改编完成: ${newComponentHtml.length} 字符`);

  // Step 3: 组装完整美化包
  const beautificationPack = {
    name: `${character.name}的美化包（改编自陆予觉）`,
    globalCss: newGlobalCss,
    components: [
      {
        name: '商战场景',
        htmlContent: newComponentHtml,
      },
    ],
  };

  const outputPath = `character-creation-toolkit/generated/${character.name}-beautification-v6.json`;
  await writeFile(outputPath, JSON.stringify(beautificationPack, null, 2), 'utf-8');

  console.log(`\n✅ 美化包已生成: ${outputPath}`);
  console.log(`   GlobalCSS: ${newGlobalCss.length} 字符`);
  console.log(`   组件HTML: ${newComponentHtml.length} 字符`);
  console.log('\n📝 改编内容：');
  console.log('   - 人名：陆予觉 → 沈亦寒');
  console.log('   - 场景：影帝/娱乐圈 → 总裁/商界');
  console.log('   - 类名：luyujue → shenyihan');
  console.log('   - 保留：所有布局、样式、装饰、动画');
}

main().catch(console.error);
