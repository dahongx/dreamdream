#!/usr/bin/env bun
/**
 * 更新沈亦寒的美化包为v2版本
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, beautificationPacks, characterPackSubscriptions, openingComponents, users } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('📖 读取v2美化包...');
  const v2Pack = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-beautification-v2.json', 'utf-8')
  );

  console.log('🔍 查找沈亦寒...');
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.name, '沈亦寒'))
    .limit(1);

  if (!char) {
    console.error('❌ 找不到沈亦寒');
    process.exit(1);
  }

  console.log(`✅ 找到角色: ${char.id}`);

  // 查找当前的美化包关联
  const oldSubs = await db
    .select()
    .from(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.characterId, char.id));

  // 删除旧的美化包关联和美化包本身
  for (const sub of oldSubs) {
    await db.delete(characterPackSubscriptions).where(eq(characterPackSubscriptions.characterId, char.id));
    await db.delete(openingComponents).where(eq(openingComponents.packId, sub.packId));
    await db.delete(beautificationPacks).where(eq(beautificationPacks.id, sub.packId));
    console.log(`✅ 已删除旧美化包: ${sub.packId}`);
  }

  // 查找系统用户
  const [systemUser] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1);

  // 创建新美化包
  console.log('\n🎨 创建v2美化包...');
  const [newPack] = await db
    .insert(beautificationPacks)
    .values({
      name: v2Pack.name,
      globalCss: v2Pack.globalCss,
      ownerUserId: systemUser.id,
    })
    .returning();

  console.log(`✅ 美化包已创建: ${newPack.id}`);

  // 创建组件
  console.log('\n🎭 创建演绎室组件...');
  for (const comp of v2Pack.components) {
    await db.insert(openingComponents).values({
      packId: newPack.id,
      name: comp.name,
      content: comp.htmlContent, // v2用的是htmlContent字段名
      orderIndex: 0,
    });
  }
  console.log(`✅ 已创建 ${v2Pack.components.length} 个组件`);

  // 关联到角色
  console.log('\n🔗 关联角色和美化包...');
  await db.insert(characterPackSubscriptions).values({
    characterId: char.id,
    packId: newPack.id,
    orderIndex: 0,
  });

  console.log('\n✨ 更新完成！');
  console.log(`角色ID: ${char.id}`);
  console.log(`新美化包ID: ${newPack.id}`);
  console.log(`访问链接: http://localhost:3000/chat/${char.id}`);
  console.log('\n刷新浏览器查看效果！');

  await client.end();
}

main().catch(console.error);
