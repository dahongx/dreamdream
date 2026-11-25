#!/usr/bin/env bun
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.name, '沈亦寒'))
    .limit(1);

  if (char) {
    console.log('✅ 角色存在');
    console.log(`   ID: ${char.id}`);
    console.log(`   名字: ${char.name}`);
    console.log(`   可见性: ${char.visibility}`);
    console.log(`   访问链接: http://localhost:3000/chat/${char.id}`);
  } else {
    console.log('❌ 角色不存在');
  }

  await client.end();
}

main().catch(console.error);
