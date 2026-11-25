#!/usr/bin/env bun
/**
 * 清理重复的沈亦寒，只保留最新的
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, beautificationPacks, characterPackSubscriptions, openingComponents } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('🔍 查找所有沈亦寒...');
  const allChars = await db
    .select()
    .from(characters)
    .where(eq(characters.name, '沈亦寒'));

  console.log(`找到 ${allChars.length} 个沈亦寒：`);
  allChars.forEach((c, i) => {
    console.log(`  ${i + 1}. ID: ${c.id}, 创建时间: ${c.createdAt}`);
  });

  if (allChars.length <= 1) {
    console.log('只有一个，无需删除');
    await client.end();
    return;
  }

  // 按创建时间排序，保留最新的
  allChars.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const toKeep = allChars[0];
  const toDelete = allChars.slice(1);

  console.log(`\n✅ 保留最新的: ${toKeep.id}`);
  console.log(`❌ 删除旧的: ${toDelete.map(c => c.id).join(', ')}`);

  for (const char of toDelete) {
    // 查找美化包关联
    const subs = await db
      .select()
      .from(characterPackSubscriptions)
      .where(eq(characterPackSubscriptions.characterId, char.id));

    // 删除角色（级联会删除关联）
    await db.delete(characters).where(eq(characters.id, char.id));
    console.log(`  已删除角色: ${char.id}`);

    // 删除孤立的美化包
    for (const sub of subs) {
      // 检查是否有其他角色用这个美化包
      const otherSubs = await db
        .select()
        .from(characterPackSubscriptions)
        .where(eq(characterPackSubscriptions.packId, sub.packId));

      if (otherSubs.length === 0) {
        await db.delete(openingComponents).where(eq(openingComponents.packId, sub.packId));
        await db.delete(beautificationPacks).where(eq(beautificationPacks.id, sub.packId));
        console.log(`  已删除孤立美化包: ${sub.packId}`);
      }
    }
  }

  console.log('\n✨ 清理完成！');
  console.log(`保留的角色ID: ${toKeep.id}`);
  console.log(`访问链接: http://localhost:3000/chat/${toKeep.id}`);

  await client.end();
}

main().catch(console.error);
