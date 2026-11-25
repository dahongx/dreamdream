#!/usr/bin/env bun
/**
 * Dearm 消息 cost_millicents 回填
 *
 * Why this exists:
 *   messages.cost_millicents 在 API 路由里写消息那一刻就算好存下，
 *   不是引用价表实时算。所以 src/lib/ai/pricing.ts 的价表订正后
 *   （Opus 4.7 砍 3x、Haiku 4.5 改对、Gemini cache 改 10% 政策、
 *   DeepSeek V4 Pro 改官方 USD 价等），历史行不会自动跟上。
 *
 *   AdminUsageSection 直接 SUM(cost_millicents)，所以会出现旧贵 /
 *   新便宜的混合断点。这个脚本一次性把所有历史行按当前价表重算。
 *
 * What this does:
 *   1. 拉所有 model 非空且至少一项 token > 0 的 messages
 *   2. 用 calculateCostMillicents 重算
 *   3. 仅 UPDATE 计算结果与旧值不同的行（避免无意义写入）
 *   4. 按模型分组打印 before/after 总额对照
 *
 * Modes:
 *   --dry-run   只算不写，打印 diff 报告
 *
 * Safety:
 *   - 幂等：跑多次结果一样（只对齐到当前价表）
 *   - 价表如果再改一次，重跑这个脚本即可重新对齐
 *   - 不修改 token 计数，只覆盖 cost_millicents
 */

import { config } from "dotenv";
import postgres from "postgres";
import {
  calculateCnyMillicents,
  calculateCostMillicents,
  getModelPricing,
  type TokenUsageDetails,
} from "../src/lib/ai/pricing";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (check .env.local)");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

interface Row {
  id: string;
  model: string;
  tokens_in: number | null;
  tokens_out: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
  cost_millicents: number | null;
  cost_cny_millicents: number | null;
}

const rows = await sql<Row[]>`
  SELECT id, model, tokens_in, tokens_out, cache_read_tokens,
         cache_write_tokens, reasoning_tokens, cost_millicents,
         cost_cny_millicents
  FROM messages
  WHERE model IS NOT NULL
    AND (coalesce(tokens_in, 0) > 0
      OR coalesce(tokens_out, 0) > 0
      OR coalesce(cache_read_tokens, 0) > 0
      OR coalesce(reasoning_tokens, 0) > 0)
`;

console.log(`scanned ${rows.length} candidate rows`);

interface Stat {
  count: number;
  changed: number;
  unknownModel: number;
  oldSum: number;
  newSum: number;
}
const perModel = new Map<string, Stat>();
const updates: Array<{ id: string; cost: number; costCny: number }> = [];

for (const r of rows) {
  const stat = perModel.get(r.model) ?? {
    count: 0,
    changed: 0,
    unknownModel: 0,
    oldSum: 0,
    newSum: 0,
  };
  stat.count++;

  const details: TokenUsageDetails = {
    inputTokens: r.tokens_in ?? undefined,
    outputTokens: r.tokens_out ?? undefined,
    cacheReadTokens: r.cache_read_tokens ?? undefined,
    cacheWriteTokens: r.cache_write_tokens ?? undefined,
    reasoningTokens: r.reasoning_tokens ?? undefined,
  };

  const newCost = await calculateCostMillicents(r.model, details);
  const oldCost = r.cost_millicents ?? 0;

  // calculateCostMillicents returns 0 when model is unknown to both the DB
  // Flag those separately so we don't quietly zero-out real prices.
  if (newCost === 0 && (r.tokens_in || r.tokens_out)) {
    // Could still be a legit free model, but more likely an unknown model id.
    // We only count it; we still apply the 0 if user really wants.
    stat.unknownModel++;
  }

  // CNY recompute uses the model's CURRENT rate. Historical messages with
  // an earlier rate get rewritten by design: this script is "re-snapshot
  // all costs at today's rates". Don't run it casually.
  const pricing = await getModelPricing(r.model);
  const newCostCny = pricing
    ? calculateCnyMillicents(newCost, pricing.usdCnyRate)
    : 0;
  const oldCostCny = r.cost_cny_millicents ?? 0;

  stat.oldSum += oldCost;
  stat.newSum += newCost;

  if (newCost !== oldCost || newCostCny !== oldCostCny) {
    stat.changed++;
    updates.push({ id: r.id, cost: newCost, costCny: newCostCny });
  }

  perModel.set(r.model, stat);
}

console.log("\n=== per-model summary (USD) ===");
console.log(
  "model                                  rows  changed  unknown  old_total   new_total   delta",
);
for (const [model, s] of [...perModel.entries()].sort()) {
  const old$ = (s.oldSum / 100_000).toFixed(4);
  const new$ = (s.newSum / 100_000).toFixed(4);
  const delta$ = ((s.newSum - s.oldSum) / 100_000).toFixed(4);
  console.log(
    `${model.padEnd(38)} ${String(s.count).padStart(4)}  ${String(s.changed).padStart(7)}  ${String(s.unknownModel).padStart(7)}  ${old$.padStart(10)}  ${new$.padStart(10)}  ${delta$.padStart(10)}`,
  );
}

const totalOld = [...perModel.values()].reduce((a, s) => a + s.oldSum, 0);
const totalNew = [...perModel.values()].reduce((a, s) => a + s.newSum, 0);
console.log(
  `\ntotal: old $${(totalOld / 100_000).toFixed(4)} → new $${(totalNew / 100_000).toFixed(4)}  (delta $${((totalNew - totalOld) / 100_000).toFixed(4)})`,
);
console.log(`rows needing update: ${updates.length}`);

if (dryRun) {
  console.log("\n--dry-run set; no writes performed");
  await sql.end();
  process.exit(0);
}

if (updates.length === 0) {
  console.log("\n✓ nothing to update");
  await sql.end();
  process.exit(0);
}

console.log(`\napplying ${updates.length} updates...`);

// Batch by 500 to keep statement size sane.
const CHUNK = 500;
let written = 0;
for (let i = 0; i < updates.length; i += CHUNK) {
  const batch = updates.slice(i, i + CHUNK);
  await sql.begin(async (tx) => {
    for (const u of batch) {
      await tx`UPDATE messages SET cost_millicents = ${u.cost}, cost_cny_millicents = ${u.costCny} WHERE id = ${u.id}`;
    }
  });
  written += batch.length;
  console.log(`  ${written}/${updates.length}`);
}

console.log(`\n✓ done; ${written} rows updated`);
await sql.end();
