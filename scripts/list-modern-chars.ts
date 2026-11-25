#!/usr/bin/env bun
/**
 * 筛选高质量现言卡
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, beautificationPacks, characterPackSubscriptions, openingComponents } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile } from 'fs/promises';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('🔍 筛选现言风格角色...\n');

  // 获取所有角色
  const allChars = await db.select().from(characters);

  const modernChars = [];

  for (const char of allChars) {
    // 排除测试卡的特征
    const isTest =
      char.name.includes('测试') ||
      char.name.includes('test') ||
      char.name.includes('Test') ||
      char.name.includes('角色') ||
      char.name.includes('小白') ||
      char.name.includes('abc');

    if (isTest) continue;

    // 查找美化包
    const subs = await db
      .select()
      .from(characterPackSubscriptions)
      .where(eq(characterPackSubscriptions.characterId, char.id));

    if (subs.length === 0) continue;

    const packId = subs[0].packId;
    const [pack] = await db
      .select()
      .from(beautificationPacks)
      .where(eq(beautificationPacks.id, packId));

    if (!pack) continue;

    const components = await db
      .select()
      .from(openingComponents)
      .where(eq(openingComponents.packId, packId));

    const totalLength = (pack.globalCss?.length || 0) + (components[0]?.content?.length || 0);

    // 必须有实质内容
    if (totalLength < 5000) continue;

    // 检查是否是现言风格
    const cssContent = pack.globalCss?.toLowerCase() || '';
    const tags = char.tags || [];

    // 古风特征（排除）
    const hasAncientFeatures =
      cssContent.includes('茶韵') ||
      cssContent.includes('墨韵') ||
      cssContent.includes('古风') ||
      cssContent.includes('宋体') ||
      cssContent.includes('jinghua') ||
      tags.some(t => t.includes('古风'));

    // 现言特征（包含）
    const hasModernFeatures =
      tags.some(t => t.includes('现代') || t.includes('现言') || t.includes('都市') || t.includes('总裁')) ||
      char.bio?.includes('总裁') ||
      char.bio?.includes('现代') ||
      char.bio?.includes('都市');

    // 即使没有明确标签，只要不是古风，且有完整美化，也可能是现言
    const mightBeModern = !hasAncientFeatures && totalLength > 10000;

    if (hasModernFeatures || mightBeModern) {
      modernChars.push({
        name: char.name,
        id: char.id,
        bio: char.bio,
        tags: char.tags,
        globalCssLength: pack.globalCss?.length || 0,
        componentLength: components[0]?.content?.length || 0,
        totalLength: totalLength,
        hasModernTag: hasModernFeatures,
      });
    }
  }

  // 按美化包大小排序
  modernChars.sort((a, b) => b.totalLength - a.totalLength);

  console.log(`找到 ${modernChars.length} 个可能的现言角色（已排除测试卡）\n`);
  console.log('排名 | 角色名 | Bio | 标签 | CSS大小 | 组件大小 | 总大小');
  console.log('---|---|---|---|---|---|---');

  modernChars.slice(0, 20).forEach((char, i) => {
    const tagsStr = char.tags?.slice(0, 3).join(', ') || '无';
    const bioShort = char.bio?.substring(0, 20) || '无';
    console.log(
      `${i + 1} | ${char.name} | ${bioShort} | ${tagsStr} | ${char.globalCssLength} | ${char.componentLength} | ${char.totalLength}`
    );
  });

  // 保存完整列表
  await writeFile(
    'character-creation-toolkit/modern-chars-list.json',
    JSON.stringify(modernChars, null, 2),
    'utf-8'
  );

  console.log('\n✅ 完整列表已保存到 modern-chars-list.json');
  console.log('\n💡 建议：');
  console.log('   1. 看看前5名哪个最适合（总大小>20000的通常比较精美）');
  console.log('   2. 如果不确定，可以访问角色页面查看实际效果');

  await client.end();
}

main().catch(console.error);
