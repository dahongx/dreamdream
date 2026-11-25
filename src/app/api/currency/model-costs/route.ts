/**
 * GET /api/currency/model-costs
 *
 * 查询所有模型的货币消耗配置（金币/银币）
 */

import { db } from "@/lib/db/client";
import { modelPrices } from "@/lib/db/schema";

export async function GET() {
  try {
    const costs = await db
      .select({
        modelId: modelPrices.modelId,
        goldCostPerCall: modelPrices.goldCostPerCall,
        silverCostPerCall: modelPrices.silverCostPerCall,
      })
      .from(modelPrices);

    // 转换为 map 格式方便前端查询
    const costMap: Record<string, { gold: number; silver: number }> = {};
    for (const cost of costs) {
      costMap[cost.modelId] = {
        gold: cost.goldCostPerCall,
        silver: cost.silverCostPerCall,
      };
    }

    return Response.json({ costs: costMap });
  } catch (error) {
    console.error("Failed to fetch model costs:", error);
    return Response.json(
      { error: "Failed to fetch model costs" },
      { status: 500 },
    );
  }
}
