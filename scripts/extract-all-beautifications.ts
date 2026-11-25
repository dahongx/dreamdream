#!/usr/bin/env bun
/**
 * 提取所有美化包作为素材库
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { beautificationPacks, openingComponents, characters, characterPackSubscriptions } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir } from 'fs/promises';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('📦 提取所有美化包...');

  const allPacks = await db.select().from(beautificationPacks);

  console.log(`找到 ${allPacks.length} 个美化包`);

  await mkdir('character-creation-toolkit/beautification-library', { recursive: true });

  for (const pack of allPacks) {
    // 获取组件
    const components = await db
      .select()
      .from(openingComponents)
      .where(eq(openingComponents.packId, pack.id));

    // 获取使用该美化包的角色
    const subs = await db
      .select()
      .from(characterPackSubscriptions)
      .where(eq(characterPackSubscriptions.packId, pack.id));

    const charNames = [];
    for (const sub of subs) {
      const [char] = await db
        .select()
        .from(characters)
        .where(eq(characters.id, sub.characterId));
      if (char) charNames.push(char.name);
    }

    const packData = {
      id: pack.id,
      name: pack.name,
      usedBy: charNames,
      globalCss: pack.globalCss,
      components: components.map((c) => ({
        name: c.name,
        content: c.content,
        enabled: c.enabled,
      })),
    };

    const fileName = `${charNames.join('-') || pack.id}.json`;
    await writeFile(
      `character-creation-toolkit/beautification-library/${fileName}`,
      JSON.stringify(packData, null, 2),
      'utf-8'
    );

    console.log(`✅ 已提取: ${fileName} (${charNames.join(', ') || 'unused'})`);
  }

  console.log('\n✨ 所有美化包已提取到 character-creation-toolkit/beautification-library/');

  await client.end();
}

main().catch(console.error);
