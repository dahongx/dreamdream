#!/usr/bin/env bun

/**
 * 手动开通/续费会员脚本
 *
 * 用法：
 *   bun scripts/manual-grant-membership.ts <email> <tier>
 *
 * tier 选项：
 *   - gold: 黄金会员（立即 900 金币 + 每日 90 银币）
 *   - platinum: 钻石会员（立即 2700 金币 + 每日 30 银币）
 *   - diamond: 铂金会员（立即 6400 金币 + 每日 30 银币）
 *
 * 示例：
 *   bun scripts/manual-grant-membership.ts test@test.com gold
 *   bun scripts/manual-grant-membership.ts hongxda@gmail.com diamond
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { MembershipTier } from "@/lib/membership/constants";
import { grantMembership, tierDisplayName } from "@/lib/membership/grant";

async function main() {
  const [email, tier] = process.argv.slice(2);

  if (!email || !tier) {
    console.error(
      "❌ 用法: bun scripts/manual-grant-membership.ts <email> <tier>",
    );
    console.error("   tier 选项: gold | platinum | diamond");
    console.error(
      "   示例: bun scripts/manual-grant-membership.ts test@test.com gold",
    );
    process.exit(1);
  }

  if (!["gold", "platinum", "diamond"].includes(tier)) {
    console.error(`❌ 无效的会员等级：${tier}`);
    console.error("   有效选项: gold | platinum | diamond");
    process.exit(1);
  }

  console.log(`\n🔍 查找用户：${email}`);

  // 查找用户
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      goldBalance: users.goldBalance,
      membershipTier: users.membershipTier,
      membershipExpiresAt: users.membershipExpiresAt,
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
  console.log(`   当前会员等级：${user.membershipTier ?? "无"}`);
  console.log(
    `   当前到期时间：${user.membershipExpiresAt?.toISOString().split("T")[0] ?? "无"}`,
  );

  // 执行开通会员
  const tierName = tierDisplayName(tier as MembershipTier);
  console.log(`\n👑 开通${tierName}...`);

  try {
    let newExpiresAt: Date | undefined;

    await db.transaction(async (tx) => {
      newExpiresAt = await grantMembership(
        tx,
        user.id,
        tier as MembershipTier,
        {
          source: "admin",
          operatorId: undefined,
        },
      );
    });

    if (!newExpiresAt) {
      throw new Error("Failed to get expiration date");
    }

    // 查询开通后的状态
    const [updated] = await db
      .select({
        goldBalance: users.goldBalance,
        membershipTier: users.membershipTier,
        membershipExpiresAt: users.membershipExpiresAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    console.log(`✅ 开通成功！`);
    console.log(
      `   会员等级：${tierDisplayName(updated?.membershipTier as MembershipTier)}`,
    );
    console.log(
      `   到期时间：${newExpiresAt.toISOString().split("T")[0]} (购买日 + 30 天)`,
    );
    console.log(`   新金币余额：${updated?.goldBalance ?? "未知"}`);
    console.log(`\n📝 交易记录已生成，可在「充值记录」tab 查看`);
  } catch (err) {
    console.error(`❌ 开通失败：`, err);
    process.exit(1);
  }
}

main();
