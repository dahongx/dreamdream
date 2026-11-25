#!/usr/bin/env bun
/**
 * 完整导入 Mufy 角色卡数据 - 包含所有内容（prompt字段 + CSS美化）
 *
 * 功能：
 * 1. 从 prompt 中提取标签段（CharaPrompt, Greeting, PlotSetting, OutputSetting, StyleSamples）
 * 2. 提取 <style> 标签中的 CSS
 * 3. 创建角色并填充所有字段
 * 4. 创建美化包并填入 CSS（转换选择器 mufy_ → nj_）
 * 5. 自动订阅美化包
 *
 * 用法:
 *   bun run scripts/import-mufy-complete.ts --input selected_character_prompts(1).json --owner-email your@email.com --commit
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const CHARACTER_SPECS = [
  { name: "陆永琛", age: 40, bio: "永昌国际集团执行董事" },
  { name: "沈知衡", age: 39, bio: "沈氏掌权人，「涵澹资本」核心" },
  { name: "闵熙彻", age: 20, bio: "京大戏剧学院模特系学生、网红" },
  { name: "公仪晢", age: 26, bio: "大殷承安帝" },
  { name: "喻承砚", age: 31, bio: "承远集团总裁" },
  { name: "赵漳平", age: 35, bio: "闽市政务总长" },
] as const;

function extractSection(prompt: string, tag: string): string | null {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const firstClose = prompt.indexOf(close);

  if (firstClose < 0) {
    return null;
  }

  // 找到最近的开始标签
  const payloadOpen = prompt.lastIndexOf(open, firstClose);
  if (payloadOpen < 0 || firstClose < payloadOpen) {
    return null;
  }

  // 检查是否有重复的关闭标签
  if (prompt.indexOf(close, firstClose + close.length) >= 0) {
    console.warn(`Warning: Duplicate </${tag}> found, using first occurrence`);
  }

  const content = prompt.slice(payloadOpen + open.length, firstClose).trim();
  return content.length > 0 ? content : null;
}

function extractCSS(prompt: string): string | null {
  const match = prompt.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!match) {
    return null;
  }
  const css = match[1].trim();
  return css.length > 0 ? css : null;
}

function convertLegacySelectors(css: string): string {
  // 将 mufy_ 选择器转换为 nj_
  return css.replace(/mufy_/g, "nj_");
}

interface CharacterData {
  name: string;
  age: number;
  bio: string;
  sourceKey: string | null;
  sourceHash: string | null;
  fields: {
    persona: string | null;
    opening: string | null;
    plotSetting: string | null;
    outputSetting: string | null;
    sampleDialogue: string | null;
  };
  css: string | null;
}

async function parseJSON(inputPath: string): Promise<CharacterData[]> {
  const raw = await readFile(inputPath, "utf8");
  const data = JSON.parse(raw);

  const sourceRecords = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "characters" in data && Array.isArray(data.characters)
    ? data.characters
    : null;

  if (!sourceRecords) {
    throw new Error("Invalid JSON structure: expected array or {characters: array}");
  }

  const results: CharacterData[] = [];

  for (const spec of CHARACTER_SPECS) {
    const records = sourceRecords.filter((r: any) => r.character_name === spec.name);
    if (records.length === 0) {
      console.warn(`⚠️  角色 ${spec.name} 在源文件中未找到，跳过`);
      continue;
    }
    if (records.length > 1) {
      console.warn(`⚠️  角色 ${spec.name} 有多条记录(${records.length})，使用第一条`);
    }

    const record = records[0];
    if (record.found !== true) {
      console.warn(`⚠️  角色 ${spec.name} 标记为未找到完整数据，跳过`);
      continue;
    }

    const prompt = record.prompt;
    if (typeof prompt !== "string" || prompt.length === 0) {
      console.warn(`⚠️  角色 ${spec.name} 没有 prompt 数据，跳过`);
      continue;
    }

    // 提取各个字段
    const persona = extractSection(prompt, "CharaPrompt");
    const opening = extractSection(prompt, "Greeting");
    const plotSetting = extractSection(prompt, "PlotSetting");
    const outputSetting = extractSection(prompt, "OutputSetting");
    const sampleDialogue = extractSection(prompt, "StyleSamples");
    const css = extractCSS(prompt);

    if (!persona) {
      throw new Error(`角色 ${spec.name} 缺少必需的 <CharaPrompt> 字段`);
    }

    results.push({
      name: spec.name,
      age: spec.age,
      bio: spec.bio,
      sourceKey: typeof record.character_key === "string" ? record.character_key : null,
      sourceHash: typeof record.canonical_prompt_hash === "string" ? record.canonical_prompt_hash : null,
      fields: {
        persona,
        opening,
        plotSetting,
        outputSetting,
        sampleDialogue,
      },
      css: css ? convertLegacySelectors(css) : null,
    });

    console.log(`✓ 解析角色 ${spec.name}:`, {
      persona: persona?.length || 0,
      opening: opening?.length || 0,
      plotSetting: plotSetting?.length || 0,
      outputSetting: outputSetting?.length || 0,
      sampleDialogue: sampleDialogue?.length || 0,
      css: css?.length || 0,
    });
  }

  return results;
}

async function main() {
  const commit = process.argv.includes("--commit");
  const inputPath = resolve(
    process.argv[process.argv.indexOf("--input") + 1] ||
    "selected_character_prompts(1).json"
  );
  const ownerEmail = process.argv[process.argv.indexOf("--owner-email") + 1] || "test@test.com";
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL 环境变量未设置");
  }

  console.log("\n========================================");
  console.log("Mufy 角色完整导入脚本");
  console.log("========================================");
  console.log(`输入文件: ${inputPath}`);
  console.log(`所有者: ${ownerEmail}`);
  console.log(`模式: ${commit ? "✅ COMMIT（真实写入）" : "🔍 DRY-RUN（仅预览）"}`);
  console.log(`数据库: ${databaseUrl.replace(/:[^:@]+@/, ":***@")}`);
  console.log("========================================\n");

  // 解析 JSON
  const characters = await parseJSON(inputPath);
  console.log(`\n成功解析 ${characters.length} 个角色\n`);

  // 连接数据库
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // 查找所有者
    const owners = await sql<{ id: string; email: string; role: string }[]>`
      select id, email, role from users where lower(email) = lower(${ownerEmail})
    `;
    if (owners.length !== 1) {
      throw new Error(`找不到用户 ${ownerEmail}（或找到多个）`);
    }
    const owner = owners[0];
    console.log(`✓ 找到所有者: ${owner.email} (${owner.id})\n`);

    // 检查是否已存在同名角色
    const existing = await sql<{ id: string; name: string }[]>`
      select id, name
      from characters
      where owner_id = ${owner.id}
        and name = any(${sql.array(characters.map(c => c.name))})
    `;
    if (existing.length > 0) {
      console.error(`❌ 以下角色已存在，无法导入（避免覆盖）:`);
      existing.forEach(e => console.error(`   - ${e.name} (${e.id})`));
      throw new Error("存在重名角色");
    }

    if (!commit) {
      console.log("\n========================================");
      console.log("🔍 DRY-RUN 模式 - 未写入数据库");
      console.log("========================================");
      console.log(`将创建 ${characters.length} 个角色及其美化包`);
      characters.forEach(c => {
        console.log(`\n角色: ${c.name}`);
        console.log(`  - persona: ${c.fields.persona?.length || 0} 字符`);
        console.log(`  - opening: ${c.fields.opening?.length || 0} 字符`);
        console.log(`  - plotSetting: ${c.fields.plotSetting?.length || 0} 字符`);
        console.log(`  - outputSetting: ${c.fields.outputSetting?.length || 0} 字符`);
        console.log(`  - sampleDialogue: ${c.fields.sampleDialogue?.length || 0} 字符`);
        console.log(`  - CSS: ${c.css?.length || 0} 字符`);
      });
      console.log("\n添加 --commit 参数以真实写入\n");
      return;
    }

    // 开始事务写入
    console.log("\n========================================");
    console.log("开始导入...");
    console.log("========================================\n");

    const results = await sql.begin(async tx => {
      const inserted: Array<{
        name: string;
        characterId: string;
        packId: string;
      }> = [];

      for (const char of characters) {
        console.log(`导入 ${char.name}...`);

        // 创建角色
        const [character] = await tx<{ id: string }[]>`
          insert into characters (
            owner_id, name, gender, age, nsfw, is_ai, content_type,
            tags, bio, visibility, persona, adversity, default_cognition,
            opening, plot_setting, output_setting, sample_dialogue
          ) values (
            ${owner.id}, ${char.name}, 'male', ${char.age}, true, false, 'original',
            ${tx.json([])}, ${char.bio}, 'private', ${char.fields.persona},
            null, null, ${char.fields.opening},
            ${char.fields.plotSetting}, ${char.fields.outputSetting}, ${char.fields.sampleDialogue}
          )
          returning id
        `;

        // 创建美化包
        const [pack] = await tx<{ id: string }[]>`
          insert into beautification_packs (owner_user_id, name, description, is_public, global_css)
          values (
            ${owner.id},
            ${`${char.name} 的美化包`},
            ${"从 Mufy 完整迁移的美化包（包含 CSS）"},
            false,
            ${char.css}
          )
          returning id
        `;

        // 订阅美化包
        await tx`
          insert into character_pack_subscriptions (character_id, pack_id, order_index)
          values (${character.id}, ${pack.id}, 0)
        `;

        inserted.push({
          name: char.name,
          characterId: character.id,
          packId: pack.id,
        });

        console.log(`  ✓ 角色 ID: ${character.id}`);
        console.log(`  ✓ 美化包 ID: ${pack.id}`);
      }

      return inserted;
    });

    console.log("\n========================================");
    console.log("✅ 导入完成！");
    console.log("========================================");
    console.log(`成功导入 ${results.length} 个角色:\n`);
    results.forEach(r => {
      console.log(`  ${r.name}`);
      console.log(`    角色: ${r.characterId}`);
      console.log(`    美化包: ${r.packId}`);
    });
    console.log("");

  } finally {
    await sql.end();
  }
}

main().catch(error => {
  console.error("\n❌ 错误:");
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) {
    console.error("\n堆栈:");
    console.error(error.stack);
  }
  process.exit(1);
});
