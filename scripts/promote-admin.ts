#!/usr/bin/env bun
/**
 * 把指定 email 的账号提升为 admin（最高权限：所有查看/审计/debug/无限额度）。
 *
 * 跑法:
 *   bun run scripts/promote-admin.ts <email>
 *
 * 幂等：已是 admin 则跳过；email 未注册则报错退出（不创建账号）。
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("usage: bun run scripts/promote-admin.ts <email>");
  process.exit(1);
}

const [row] = await db
  .select({ id: users.id, email: users.email, role: users.role })
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (!row) {
  console.error(`✗ 邮箱 ${email} 尚未注册；请该用户先注册后再运行本脚本。`);
  process.exit(1);
}

if (row.role === "admin") {
  console.log(`✓ ${email} 已是 admin (id=${row.id})，无需改动。`);
  process.exit(0);
}

const [updated] = await db
  .update(users)
  .set({ role: "admin" })
  .where(eq(users.email, email))
  .returning({ id: users.id, email: users.email, role: users.role });

console.log(
  `✓ ${updated.email} 已提升为 admin (id=${updated.id})，原角色=${row.role}`,
);
process.exit(0);
