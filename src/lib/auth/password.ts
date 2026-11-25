/**
 * Password hashing for the Credentials provider.
 *
 * Why bcryptjs (not Bun.password / native argon2):
 *   Next.js bundles server actions into a webpack-managed Node worker
 *   context, NOT the host Bun runtime. `Bun` global isn't defined there
 *   even when you launch via `bun run dev`. Same story for production
 *   (`next build` → Node). bcryptjs is pure JS, zero native bindings,
 *   identical behavior in Node / Bun / alpine Docker.
 *
 * Cost factor 10 matches OWASP's current recommendation; tune up later
 * if auth requests start dominating CPU.
 */

import bcrypt from "bcryptjs";

const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
