/**
 * 测试每日签到 API
 */

import { claimDailySilver } from "@/lib/currency/transactions";

const testEmail = process.argv[2] || "hongxda@gmail.com";

import { eq } from "drizzle-orm";
// 从数据库获取用户 ID
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

async function test() {
  console.log(`测试账号: ${testEmail}`);

  // 获取用户
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      membershipTier: users.membershipTier,
    })
    .from(users)
    .where(eq(users.email, testEmail))
    .limit(1);

  if (!user) {
    console.error("用户不存在");
    process.exit(1);
  }

  console.log(`用户ID: ${user.id}`);
  console.log(`会员等级: ${user.membershipTier || "regular"}`);

  // 调用签到
  const result = await claimDailySilver(user.id);

  console.log("\n签到结果:");
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
