#!/usr/bin/env bun
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, beautificationPacks, characterPackSubscriptions, openingComponents } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('=== 检查 Mufy 数据 ===\n');

  // 查询所有角色
  const allChars = await db.select().from(characters);
  console.log(`📊 总角色数: ${allChars.length}\n`);

  // 查询所有美化包
  const allPacks = await db.select().from(beautificationPacks);
  console.log(`🎨 总美化包数: ${allPacks.length}\n`);

  // 查询角色-美化包关联
  const subscriptions = await db.select().from(characterPackSubscriptions);
  console.log(`🔗 角色订阅美化包数: ${subscriptions.length}\n`);

  // 详细列出每个角色
  console.log('=== 角色详情 ===\n');
  for (const char of allChars) {
    console.log(`📌 ${char.name} (ID: ${char.id})`);
    console.log(`   创建者: ${char.creatorId}`);
    console.log(`   标签: ${char.tags?.join(', ') || '无'}`);
    console.log(`   persona 长度: ${char.persona?.length || 0} 字符`);
    console.log(`   opening 长度: ${char.opening?.length || 0} 字符`);
    console.log(`   sampleDialogue 长度: ${char.sampleDialogue?.length || 0} 字符`);

    // 查找对应的美化包
    const sub = subscriptions.find(s => s.characterId === char.id);
    if (sub) {
      const pack = allPacks.find(p => p.id === sub.packId);
      if (pack) {
        console.log(`   🎨 美化包: ${pack.name} (ID: ${pack.id})`);

        // 查询美化包的组件
        const components = await db
          .select()
          .from(openingComponents)
          .where(eq(openingComponents.packId, pack.id));
        console.log(`   📦 组件数: ${components.length}`);
      }
    }
    console.log('');
  }

  // 详细列出每个美化包
  console.log('\n=== 美化包详情 ===\n');
  for (const pack of allPacks) {
    console.log(`🎨 ${pack.name} (ID: ${pack.id})`);
    console.log(`   创建者: ${pack.creatorId}`);
    console.log(`   globalCss 长度: ${pack.globalCss?.length || 0} 字符`);

    const components = await db
      .select()
      .from(openingComponents)
      .where(eq(openingComponents.packId, pack.id));

    console.log(`   组件数: ${components.length}`);
    components.forEach(comp => {
      console.log(`     - ${comp.name}: ${comp.htmlContent?.length || 0} 字符`);
    });
    console.log('');
  }

  await client.end();
  process.exit(0);
}

main().catch(console.error);
