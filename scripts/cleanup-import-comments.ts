#!/usr/bin/env bun
/**
 * 清理数据库中所有美化包 globalCss 字段里的导入注释标记。
 *
 * 背景：importExternalCssToPackAction 曾在追加 CSS 时插入注释分隔符。
 * 虽然渲染时会被 sanitizeAndScopeCss 移除，但在 Studio 编辑器里会显示，
 * 影响视觉。此脚本一次性清理所有已存在的注释。
 *
 * 用法：
 *   bun run scripts/cleanup-import-comments.ts
 */

import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { beautificationPacks } from "@/lib/db/schema";

// 历史遗留数据：旧版导入 action 曾往 globalCss 里插一行 `/* ---- 从 X 导入 ---- */`
// 分隔注释。按结构匹配（注释壳 + 破折号 + 从…导入 + 破折号），不写死来源平台名，
// 这样存量行照样命中。
const COMMENT_PATTERN = /\/\*\s*[-—]+\s*从\s*\S+\s*导入\s*[-—]+\s*\*\/\n?/gi;

async function main() {
  console.log("正在查找包含导入注释的美化包...\n");

  // 查找所有有 globalCss 的包
  const packs = await db
    .select({
      id: beautificationPacks.id,
      name: beautificationPacks.name,
      globalCss: beautificationPacks.globalCss,
    })
    .from(beautificationPacks)
    .where(isNotNull(beautificationPacks.globalCss));

  let updatedCount = 0;
  const updates: Array<{
    id: string;
    name: string;
    before: number;
    after: number;
  }> = [];

  for (const pack of packs) {
    const css = pack.globalCss ?? "";
    if (!css.match(COMMENT_PATTERN)) continue;

    const cleaned = css.replace(COMMENT_PATTERN, "");
    const beforeLength = css.length;
    const afterLength = cleaned.length;

    await db
      .update(beautificationPacks)
      .set({ globalCss: cleaned })
      .where(eq(beautificationPacks.id, pack.id));

    updatedCount++;
    updates.push({
      id: pack.id,
      name: pack.name,
      before: beforeLength,
      after: afterLength,
    });

    console.log(`[${pack.name}]`);
    console.log(`   ID: ${pack.id}`);
    console.log(`   清理前: ${beforeLength} 字符`);
    console.log(`   清理后: ${afterLength} 字符`);
    console.log(`   减少: ${beforeLength - afterLength} 字符\n`);
  }

  if (updatedCount === 0) {
    console.log("没有找到需要清理的注释，数据库已经是干净的！");
  } else {
    console.log("\n总结:");
    console.log(`   已清理 ${updatedCount} 个美化包`);
    console.log(`   共检查 ${packs.length} 个包`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("清理失败:", error);
  process.exit(1);
});
