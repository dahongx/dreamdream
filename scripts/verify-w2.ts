/**
 * W2 verification: create a sample character, then list-explore it.
 * Hits the real Neon DB and exits non-zero on failure.
 *
 * Usage: bun run scripts/verify-w2.ts
 *   --keep  Leave the row in DB (default deletes it after verify)
 */

import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

const { db } = await import("../src/lib/db/client");
const { characters, users } = await import("../src/lib/db/schema");
const { listCharactersForExplore } = await import(
  "../src/lib/characters/queries"
);

const keep = process.argv.includes("--keep");

async function ensureDevUser(): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "dev@yearn.local"))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(users)
    .values({
      email: "dev@yearn.local",
      name: "dev",
      displayName: "dev",
      username: "dev",
    })
    .returning({ id: users.id });
  return row.id;
}

const ownerId = await ensureDevUser();
console.log("[1/4] dev user id:", ownerId);

const [created] = await db
  .insert(characters)
  .values({
    ownerId,
    name: "测试 · 寄情初代",
    persona: "一个用于 W2 端到端验证的临时角色，性格冷静，话不多。",
    bio: "W2 verify script 自动创建。",
    visibility: "public",
    tags: ["test", "w2-verify"],
    nsfw: false,
  })
  .returning({ id: characters.id });
console.log("[2/4] created character id:", created.id);

const listed = await listCharactersForExplore({
  showNsfw: true,
  sort: "latest",
  limit: 10,
});
const found = listed.find((c) => c.id === created.id);
if (!found) {
  console.error("[FAIL] character not found in explore list");
  process.exit(1);
}
console.log("[3/4] character appears in /explore list ✓");

if (!keep) {
  await db.delete(characters).where(eq(characters.id, created.id));
  console.log("[4/4] cleanup: row deleted");
} else {
  console.log("[4/4] --keep flag: row left in DB at id", created.id);
}

console.log("\nW2 end-to-end verified: create → list pipeline works.");
process.exit(0);
