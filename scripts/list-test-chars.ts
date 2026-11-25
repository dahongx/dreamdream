#!/usr/bin/env bun
/**
 * 查找所有测试卡
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters } from '../src/lib/db/schema';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('🔍 查找所有测试卡...\n');

  const allChars = await db.select().from(characters);

  const testChars = allChars.filter(char => {
    const name = char.name.toLowerCase();
    const bio = (char.bio || '').toLowerCase();

    // 测试卡特征
    return (
      name.includes('测试') ||
      name.includes('test') ||
      name.includes('角色') ||
      name.includes('小白') ||
      name.includes('abc') ||
      bio.includes('测试') ||
      bio.includes('test')
    );
  });

  console.log(`找到 ${testChars.length} 个测试卡：\n`);

  testChars.forEach((char, i) => {
    console.log(`${i + 1}. ${char.name}`);
    if (char.bio) {
      console.log(`   Bio: ${char.bio.substring(0, 50)}...`);
    }
    console.log(`   ID: ${char.id}`);
    console.log(`   创建时间: ${char.createdAt}\n`);
  });

  await client.end();
}

main().catch(console.error);
