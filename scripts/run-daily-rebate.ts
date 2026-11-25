#!/usr/bin/env bun
/**
 * 创作者返利结算 —— 手动 / 定时入口。
 *
 * 用法：
 *   bun scripts/run-daily-rebate.ts --dry-run   # 只算不写，核对数字（强烈建议先跑）
 *   bun scripts/run-daily-rebate.ts --seed       # 首次上线播种游标（设当前值、不发钱）
 *   bun scripts/run-daily-rebate.ts              # 真跑一次结算
 *
 * 部署（服务器 crontab，每天早 8 点 Asia/Shanghai）：
 *   0 8 * * *  cd /root/projects/yearn-chat && docker compose exec -T app bun scripts/run-daily-rebate.ts >> /var/log/dearm-rebate.log 2>&1
 *   （容器内 TZ=Asia/Shanghai，见 docker-compose.yml；宿主机 crontab 若非上海时区需换算）
 *
 * env：走 DATABASE_URL（.env.local 本地 / .env 服务器）。dotenv 必须在 import
 * 返利模块之前加载，因为 db/client.ts 在 import 期就读 DATABASE_URL。
 */

import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing (check .env.local / .env)");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const seed = args.includes("--seed");

// 动态 import：确保上面的 config() 先执行完，client.ts 才读到 DATABASE_URL。
// 用相对路径而非 @/ 别名——脚本在 migrate 镜像里跑，没 COPY tsconfig.json，
// bun 解析不了 @/ paths。仓库其它 scripts（backfill-*）同样走 ../src 相对路径。
const { runDailyRebate, seedCursors } = await import(
  "../src/lib/creator/rebate"
);

if (seed) {
  console.log("seeding cursors to current cumulative values (no payout)...");
  const res = await seedCursors();
  console.log(
    `seeded: ${res.characters} character cursor(s), ${res.creators} fans cursor(s)`,
  );
  process.exit(0);
}

console.log(
  dryRun ? "running rebate (DRY-RUN, no writes)..." : "running rebate...",
);
const res = await runDailyRebate({ dryRun });

console.log("");
console.log(`characters scanned : ${res.charactersScanned}`);
console.log(`creators paid      : ${res.creatorsPaid}`);
console.log(`total paid         : ${res.totalPaid.toFixed(2)} 金币`);
console.log(`line items         : ${res.items.length}`);

if (res.items.length > 0) {
  console.log("\ntop 30 line items:");
  const sorted = [...res.items]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 30);
  for (const it of sorted) {
    const target = it.characterId ?? "(account/fans)";
    console.log(
      `  ${it.kind.padEnd(9)} ${String(it.amount.toFixed(2)).padStart(9)}  ${target}`,
    );
  }
}

if (dryRun) {
  console.log("\n[dry-run] no writes. re-run without --dry-run to apply.");
}

process.exit(0);
