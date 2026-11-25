import { eq } from "drizzle-orm";
import { interpolate, parseOpening } from "@/lib/ai/build-prompt";
import { db } from "@/lib/db/client";
import { characters, chatSessions, messages, users } from "@/lib/db/schema";

const DEV_EMAIL = "dev@yearn.local";

async function ensureDevUser() {
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEV_EMAIL))
    .limit(1);
  if (u) return u.id;
  const [row] = await db
    .insert(users)
    .values({
      email: DEV_EMAIL,
      name: "dev",
      displayName: "dev",
      username: "dev",
    })
    .returning({ id: users.id });
  return row.id;
}

async function ensureCharacter(ownerId: string) {
  const [existing] = await db
    .select()
    .from(characters)
    .where(eq(characters.ownerId, ownerId))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(characters)
    .values({
      ownerId,
      name: "测试医生",
      persona:
        "你是一名急诊室医生，名字叫{{char}}。{{user}}是你的病人。说话简短克制。",
      opening: "<message>你怎么了？</message><scenario>夜，急诊室。</scenario>",
      visibility: "public",
    })
    .returning();
  return row;
}

const userId = await ensureDevUser();
const char = await ensureCharacter(userId);
console.log("character:", char.id, char.name);

// Create session directly (skip the redirect-throwing Server Action)
const [session] = await db
  .insert(chatSessions)
  .values({
    userId,
    characterId: char.id,
    title: char.name,
  })
  .returning();
console.log("session:", session.id);

// Seed opening message
const parsed = parseOpening(char.opening);
if (parsed.firstAssistantBody) {
  await db.insert(messages).values({
    sessionId: session.id,
    role: "assistant" as const,
    content: interpolate(parsed.firstAssistantBody, {
      char: char.name,
      user: "dev",
    }),
  });
}

// Hit the API
const res = await fetch("http://localhost:3000/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessionId: session.id,
    messages: [
      { id: "u1", role: "user", parts: [{ type: "text", text: "我头很痛。" }] },
    ],
  }),
});
console.log("api status:", res.status);
if (!res.ok) {
  console.log("body:", await res.text());
  process.exit(1);
}

const reader = res.body?.getReader();
if (!reader) throw new Error("no response body");
const decoder = new TextDecoder();
let chunks = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks += decoder.decode(value);
}
console.log("stream bytes:", chunks.length);
console.log("first 300:", chunks.slice(0, 300));

await new Promise((r) => setTimeout(r, 2500));

const msgs = await db
  .select()
  .from(messages)
  .where(eq(messages.sessionId, session.id));
console.log("messages in db:", msgs.length);
for (const m of msgs) {
  console.log(
    `  - [${m.role}] "${m.content.slice(0, 80).replaceAll("\n", " ")}" model=${m.model} tin=${m.tokensIn} tout=${m.tokensOut} lat=${m.latencyMs}ms`,
  );
}

// Cleanup unless --keep
if (!process.argv.includes("--keep")) {
  await db.delete(chatSessions).where(eq(chatSessions.id, session.id));
  console.log("cleaned up session");
}
