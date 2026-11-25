#!/usr/bin/env bun
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, beautificationPacks, characterPackSubscriptions, openingComponents } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile } from 'fs/promises';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  const characterName = process.argv[2];
  if (!characterName) {
    console.error('用法: bun run scripts/export-mufy-sample.ts "角色名"');
    process.exit(1);
  }

  console.log(`📥 导出角色: ${characterName}`);

  // 查找角色
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.name, characterName))
    .limit(1);

  if (!char) {
    console.error(`❌ 找不到角色: ${characterName}`);
    process.exit(1);
  }

  console.log(`✅ 找到角色 ID: ${char.id}`);

  // 查找美化包
  const [sub] = await db
    .select()
    .from(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.characterId, char.id))
    .limit(1);

  let packData = null;
  if (sub) {
    const [pack] = await db
      .select()
      .from(beautificationPacks)
      .where(eq(beautificationPacks.id, sub.packId))
      .limit(1);

    if (pack) {
      const components = await db
        .select()
        .from(openingComponents)
        .where(eq(openingComponents.packId, pack.id));

      packData = {
        id: pack.id,
        name: pack.name,
        globalCss: pack.globalCss,
        components: components.map(c => ({
          name: c.name,
          htmlContent: c.htmlContent,
          cssScope: c.cssScope,
          runtime: c.runtime,
        })),
      };
      console.log(`✅ 找到美化包: ${pack.name}，组件数: ${components.length}`);
    }
  }

  // 组装数据
  const output = {
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
      avatarUrl: char.avatarUrl,
      coverImageUrl: char.coverImageUrl,
    },
    beautification: packData,
  };

  // 保存文件
  const filename = `character-creation-toolkit/mufy-samples/${characterName}.json`;
  await writeFile(filename, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✅ 已保存到: ${filename}`);

  // 统计信息
  console.log('\n📊 数据统计:');
  console.log(`   persona: ${char.persona?.length || 0} 字符`);
  console.log(`   opening: ${char.opening?.length || 0} 字符`);
  console.log(`   sampleDialogue: ${char.sampleDialogue?.length || 0} 字符`);
  console.log(`   美化包组件: ${packData?.components.length || 0} 个`);

  await client.end();
  process.exit(0);
}

main().catch(console.error);
