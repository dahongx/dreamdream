#!/usr/bin/env bun

/**
 * 诊断货币配置数据不一致问题
 *
 * 问题：计费配置页面显示 0/1，对话页面显示 1/2
 *
 * 此脚本检查：
 * 1. 数据库中实际存储的货币价格
 * 2. currency.ts 中的 fallback 默认值
 * 3. 可能导致不一致的原因
 */

import { NIMIR_MODELS } from "../src/lib/ai/models";
import { db } from "../src/lib/db/client";
import { modelPrices } from "../src/lib/db/schema";

async function main() {
  console.log("=== 货币配置数据诊断 ===\n");

  // 1. 检查数据库中的实际数据
  console.log("1️⃣  数据库中的货币价格配置:");
  console.log("-".repeat(80));

  try {
    const prices = await db.select().from(modelPrices);

    if (prices.length === 0) {
      console.log("❌ 数据库中没有任何货币价格配置！");
      console.log("   这会导致使用 fallback 默认值（金币 0，银币 1）\n");
    } else {
      console.table(
        prices.map((p) => ({
          模型ID: p.modelId,
          金币: p.goldCostPerCall,
          银币: p.silverCostPerCall,
          更新时间: p.updatedAt.toISOString(),
        })),
      );
      console.log();
    }

    // 2. 检查应用中定义的所有模型
    console.log("2️⃣  应用中定义的所有模型:");
    console.log("-".repeat(80));
    console.table(
      NIMIR_MODELS.map((m) => ({
        模型ID: m.id,
        显示名: m.label,
        说明: m.hint,
      })),
    );
    console.log();

    // 3. 交叉检查：哪些模型在数据库中有配置
    console.log("3️⃣  交叉检查（模型 vs 数据库配置）:");
    console.log("-".repeat(80));

    const dbModelIds = new Set(prices.map((p) => p.modelId));
    const appModelIds = NIMIR_MODELS.map((m) => m.id);

    const results = appModelIds.map((modelId) => {
      const priceRow = prices.find((p) => p.modelId === modelId);
      return {
        模型ID: modelId,
        在数据库中: priceRow ? "✅" : "❌",
        金币: priceRow ? priceRow.goldCostPerCall : "使用fallback(0)",
        银币: priceRow ? priceRow.silverCostPerCall : "使用fallback(1)",
      };
    });

    console.table(results);
    console.log();

    // 4. 分析问题
    console.log("4️⃣  问题分析:");
    console.log("-".repeat(80));

    const missingModels = appModelIds.filter((id) => !dbModelIds.has(id));

    if (missingModels.length > 0) {
      console.log("❌ 以下模型在数据库中缺失配置（会使用 fallback 默认值）:");
      for (const id of missingModels) {
        console.log(`   - ${id}`);
      }
      console.log();
    }

    // 检查是否有 0/1 的配置
    const zeroOneConfigs = prices.filter(
      (p) =>
        (p.goldCostPerCall === 0 && p.silverCostPerCall === 1) ||
        p.goldCostPerCall === 0 ||
        p.silverCostPerCall === 1,
    );

    if (zeroOneConfigs.length > 0) {
      console.log("⚠️  发现 0/1 配置（可能是管理员修改过）:");
      for (const p of zeroOneConfigs) {
        console.log(
          `   - ${p.modelId}: 金币 ${p.goldCostPerCall}, 银币 ${p.silverCostPerCall}`,
        );
      }
      console.log();
    }

    // 5. 给出建议
    console.log("5️⃣  建议:");
    console.log("-".repeat(80));

    if (missingModels.length > 0) {
      console.log("📝 需要为缺失的模型添加数据库配置");
      console.log("   运行以下 SQL 或在管理后台添加:");
      for (const id of missingModels) {
        console.log(
          `   UPDATE model_prices SET gold_cost_per_call = 0, silver_cost_per_call = 1 WHERE model_id = '${id}';`,
        );
      }
      console.log();
    }

    if (zeroOneConfigs.length > 0) {
      console.log("📝 如果 0/1 配置是正确的，但对话页面仍显示 1/2，可能原因:");
      console.log("   1. 前端缓存了旧数据（需要刷新页面）");
      console.log("   2. 正在使用的模型ID与数据库中的不匹配");
      console.log("   3. API 查询失败，使用了 fallback 值");
      console.log();
    }

    console.log("✅ 诊断完成\n");
  } catch (error) {
    console.error("❌ 查询数据库失败:", error);
    console.log("\n可能的原因:");
    console.log("1. 数据库连接配置错误");
    console.log("2. model_currency_prices 表不存在（未运行 migration 0025）");
    console.log("3. 权限问题");
  }
}

main();
