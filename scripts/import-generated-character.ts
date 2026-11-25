#!/usr/bin/env bun
/**
 * 导入AI生成的角色到数据库
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, beautificationPacks, characterPackSubscriptions, openingComponents, users } from '../src/lib/db/schema';
import { readFile } from 'fs/promises';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('📖 读取生成的完整角色数据...');
  const data = JSON.parse(
    await readFile('character-creation-toolkit/generated/沈亦寒-complete.json', 'utf-8')
  );

  const char = data.character;
  const pack = data.beautification;

  // 查找一个系统用户
  console.log('\n👤 查找系统用户...');
  const [systemUser] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1);

  if (!systemUser) {
    console.error('❌ 找不到管理员用户，请先创建管理员账户');
    process.exit(1);
  }

  console.log(`✅ 使用用户: ${systemUser.email} (${systemUser.id})`);

  console.log('\n🎨 Step 1: 创建美化包...');
  const [beautificationPack] = await db
    .insert(beautificationPacks)
    .values({
      name: pack.name,
      globalCss: pack.globalCss,
      ownerUserId: systemUser.id,
    })
    .returning();

  console.log(`✅ 美化包已创建: ${beautificationPack.id}`);

  console.log('\n🎭 Step 2: 创建演绎室组件...');
  for (const comp of pack.components) {
    await db.insert(openingComponents).values({
      packId: beautificationPack.id,
      name: comp.name,
      content: comp.htmlContent, // 注意：字段名是 content，不是 htmlContent
    });
  }
  console.log(`✅ 已创建 ${pack.components.length} 个组件`);

  console.log('\n👤 Step 3: 创建角色...');
  const [character] = await db
    .insert(characters)
    .values({
      name: char.name,
      gender: char.gender,
      age: char.age,
      tags: char.tags,
      bio: char.bio,
      persona: char.persona,
      opening: char.opening,
      sampleDialogue: char.sampleDialogue || '',
      avatarUrl: 'https://placehold.co/512x512/485F88/FFF?text=' + encodeURIComponent(char.name),
      coverImageUrl: 'https://placehold.co/1200x600/485F88/FFF?text=' + encodeURIComponent(char.name),
      ownerId: systemUser.id, // 使用找到的系统用户ID
      visibility: 'public',
    })
    .returning();

  console.log(`✅ 角色已创建: ${character.id}`);

  console.log('\n🔗 Step 4: 关联角色和美化包...');
  await db.insert(characterPackSubscriptions).values({
    characterId: character.id,
    packId: beautificationPack.id,
    orderIndex: 0,
  });

  console.log(`✅ 关联完成`);

  console.log('\n✨ 导入成功！');
  console.log(`\n角色ID: ${character.id}`);
  console.log(`美化包ID: ${beautificationPack.id}`);
  console.log(`\n访问链接: http://localhost:3000/chat/${character.id}`);

  await client.end();
  process.exit(0);
}

main().catch(console.error);
