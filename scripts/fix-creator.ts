#!/usr/bin/env bun
/**
 * 修改沈亦寒的创作者为 test
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, users, beautificationPacks, characterPackSubscriptions } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  // 查找或创建 test 用户
  let [testUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, 'test'))
    .limit(1);

  if (!testUser) {
    console.log('创建 test 用户...');
    [testUser] = await db
      .insert(users)
      .values({
        username: 'test',
        email: 'test@test.com',
        role: 'user',
      })
      .returning();
  }

  console.log(`✅ test 用户: ${testUser.id}`);

  // 更新沈亦寒的创作者
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.name, '沈亦寒'))
    .limit(1);

  if (char) {
    await db
      .update(characters)
      .set({ ownerId: testUser.id })
      .where(eq(characters.id, char.id));

    console.log(`✅ 已更新角色创作者为 test`);

    // 更新美化包创作者
    const subs = await db
      .select()
      .from(characterPackSubscriptions)
      .where(eq(characterPackSubscriptions.characterId, char.id));

    for (const sub of subs) {
      await db
        .update(beautificationPacks)
        .set({ ownerUserId: testUser.id })
        .where(eq(beautificationPacks.id, sub.packId));
    }

    console.log(`✅ 已更新美化包创作者为 test`);
  }

  await client.end();
}

main().catch(console.error);
