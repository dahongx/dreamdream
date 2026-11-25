#!/usr/bin/env bun

/**
 * 按角色批量充值金币 / 银币
 *
 * - beta_tester: gold=1000, silver=1000
 * - admin:       gold=9999999, silver=9999999
 *
 * 目的：让内测用户和管理员在测试期间不被币的闸门卡住。
 * 一次性脚本（非 migration）。新注册用户角色变化时需要再次跑。
 *
 * 使用：
 *   bunx tsx scripts/recharge-by-role.ts            # 实际执行
 *   bunx tsx scripts/recharge-by-role.ts --dry-run  # 只打印不写库
 *
 * 部署：参考 memory restart-vs-deploy-script，价表 / migrate scripts 改动
 * 走 deploy.sh 而不是 restart.sh。
 */

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { users } from "../src/lib/db/schema";

const RECHARGE: Record<
  "beta_tester" | "admin",
  { gold: number; silver: number }
> = {
  beta_tester: { gold: 1000, silver: 1000 },
  admin: { gold: 9999999, silver: 9999999 },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`=== recharge-by-role ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  for (const role of Object.keys(RECHARGE) as Array<keyof typeof RECHARGE>) {
    const targets = await db
      .select({
        id: users.id,
        email: users.email,
        goldBalance: users.goldBalance,
        silverBalance: users.silverBalance,
      })
      .from(users)
      .where(eq(users.role, role));

    const { gold, silver } = RECHARGE[role];

    console.log(
      `【${role}】共 ${targets.length} 名用户，目标余额 gold=${gold} silver=${silver}`,
    );
    for (const u of targets) {
      console.log(
        `  - ${u.email ?? u.id} : gold ${u.goldBalance} → ${gold}, silver ${u.silverBalance} → ${silver}`,
      );
    }

    if (dryRun) {
      console.log("  (DRY RUN，跳过 UPDATE)\n");
      continue;
    }

    if (targets.length > 0) {
      await db
        .update(users)
        .set({ goldBalance: gold, silverBalance: silver })
        .where(eq(users.role, role));
      console.log(`  ✓ 已更新 ${targets.length} 行\n`);
    } else {
      console.log("  (无需更新)\n");
    }
  }

  console.log("done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
