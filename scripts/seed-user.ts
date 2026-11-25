#!/usr/bin/env bun
/**
 * One-off: 创建一个用户名 + 密码登录的账号。
 *
 * 跑法:
 *   bun run scripts/seed-user.ts <username> <password>
 *   bun run scripts/seed-user.ts hmzo 123456
 *
 * 幂等：如果 username 已存在则跳过，不覆盖密码（避免误改活账号）。
 * 想重置密码 → 自己进 psql。
 */

import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error("usage: bun run scripts/seed-user.ts <username> <password>");
  process.exit(1);
}

if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
  console.error("username must be 3-32 chars, letters/digits/underscores only");
  process.exit(1);
}

if (password.length < 6) {
  console.error(
    "password must be at least 6 chars (UI requires ≥8, dev seed is lenient)",
  );
  process.exit(1);
}

const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.username, username))
  .limit(1);

if (existing[0]) {
  console.log(
    `user "${username}" already exists (id=${existing[0].id}); skipping.`,
  );
  process.exit(0);
}

const passwordHash = await hashPassword(password);
const [row] = await db
  .insert(users)
  .values({
    username,
    displayName: username,
    name: username,
    passwordHash,
  })
  .returning({ id: users.id });

console.log(`✓ created user "${username}" (id=${row.id})`);
process.exit(0);
