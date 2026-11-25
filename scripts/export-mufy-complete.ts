#!/usr/bin/env bun
/**
 * 从数据库导出方鹤之的完整美化包（包含组件content）
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, beautificationPacks, openingComponents, characterPackSubscriptions } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile } from 'fs/promises';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  // 查找方鹤之
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.name, '方鹤之'))
    .limit(1);

  if (!char) {
    console.error('❌ 找不到方鹤之');
    process.exit(1);
  }

  console.log(`✅ 找到角色: ${char.name} (${char.id})`);

  // 查找美化包
  const subscriptions = await db
    .select()
    .from(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.characterId, char.id));

  if (subscriptions.length === 0) {
    console.error('❌ 该角色没有美化包');
    process.exit(1);
  }

  const packId = subscriptions[0].packId;

  const [pack] = await db
    .select()
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, packId));

  console.log(`✅ 找到美化包: ${pack.name}`);

  // 查找组件（包含content）
  const components = await db
    .select()
    .from(openingComponents)
    .where(eq(openingComponents.packId, packId));

  console.log(`✅ 找到 ${components.length} 个组件`);

  // 组装完整数据
  const fullData = {
    character: {
      id: char.id,
      name: char.name,
      gender: char.gender,
      age: char.age,
      tags: char.tags,
      bio: char.bio,
      persona: char.persona,
      opening: char.opening,
      sampleDialogue: char.sampleDialogue,
    },
    beautification: {
      id: pack.id,
      name: pack.name,
      globalCss: pack.globalCss,
      components: components.map((c) => ({
        name: c.name,
        content: c.content,
        enabled: c.enabled,
        orderIndex: c.orderIndex,
      })),
    },
  };

  const outputPath = 'character-creation-toolkit/mufy-samples/方鹤之-complete.json';
  await writeFile(outputPath, JSON.stringify(fullData, null, 2), 'utf-8');

  console.log(`✅ 完整数据已导出: ${outputPath}`);
  console.log(`   组件内容长度: ${components.map(c => c.content?.length || 0).join(', ')}`);

  await client.end();
  process.exit(0);
}

main().catch(console.error);
