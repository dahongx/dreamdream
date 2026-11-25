#!/usr/bin/env bun

/**
 * 手动充值金币包脚本
 *
 * 用法：
 *   bun scripts/manual-recharge-gold.ts <email> <amount>
 *
 * 示例：
 *   bun scripts/manual-recharge-gold.ts test@test.com 1000
 *   bun scripts/manual-recharge-gold.ts hongxda@gmail.com 500
 */

import { eq } from "drizzle-orm";
import { rechargeGold } from "@/lib/currency/recharge-gold";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

async function main() {
  const [email, amountStr] = process.argv.slice(2);

  if (!email || !amountStr) {
    console.error(
      "❌ 用法: bun scripts/manual-recharge-gold.ts <email> <amount>",
    );
    console.error(
      "   示例: bun scripts/manual-recharge-gold.ts test@test.com 1000",
    );
    process.exit(1);
  }

  const amount = Number.parseInt(amountStr, 10);
  if (Number.isNaN(amount) || amount <= 0) {
    console.error(`❌ 金币数量必须是大于 0 的整数，收到：${amountStr}`);
    process.exit(1);
  }

  console.log(`\n🔍 查找用户：${email}`);

  // 查找用户
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      goldBalance: users.goldBalance,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`❌ 用户不存在：${email}`);
    process.exit(1);
  }

  console.log(`✅ 找到用户：${user.email}`);
  console.log(`   当前金币余额：${user.goldBalance}`);

  // 执行充值
  console.log(`\n💰 充值 ${amount} 金币...`);

  try {
    await db.transaction(async (tx) => {
      await rechargeGold(tx, user.id, amount, {
        source: "admin",
        packageId: undefined,
      });
    });

    // 查询充值后的余额
    const [updated] = await db
      .select({ goldBalance: users.goldBalance })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    console.log(`✅ 充值成功！`);
    console.log(`   充值金额：+${amount}`);
    console.log(`   新余额：${updated?.goldBalance ?? "未知"}`);
    console.log(`\n📝 交易记录已生成，可在「充值记录」tab 查看`);
  } catch (err) {
    console.error(`❌ 充值失败：`, err);
    process.exit(1);
  }
}

main();
