#!/usr/bin/env bun
import { eq } from "drizzle-orm";
/**
 * 一次性修复:把角色卡图片里指向旧自建 Supabase(裸 IP + http)的 URL
 * 前缀换成云 Supabase(https)。文件在迁云时已同路径复制到云 bucket,
 * 故只改 URL 前缀即可,不重新上传。
 *
 * 背景:站点走 HTTPS,旧的 http://115.29.213.73:8000 图属于 mixed content,
 * 浏览器自动升级到 https:// 裸 IP → 无证书失败 → 拦成裂图。
 *
 * 幂等:只匹配含 OLD_HOST 的字段;跑第二遍匹配为 0。
 * 跑法:bun run scripts/fix-oldhost-images.ts
 */
import { db } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";

const OLD_PREFIX = "http://115.29.213.73:8000";
const NEW_PREFIX =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://gkhnsrqnmcccmsmxqvlm.supabase.co";

const rows = await db
  .select({
    id: characters.id,
    name: characters.name,
    avatarUrl: characters.avatarUrl,
    coverImageUrl: characters.coverImageUrl,
  })
  .from(characters);

async function reachable(url: string): Promise<number> {
  try {
    const r = await fetch(url, { method: "GET" });
    return r.status;
  } catch {
    return 0;
  }
}

let touched = 0;
for (const r of rows) {
  const nextAvatar = r.avatarUrl?.startsWith(OLD_PREFIX)
    ? r.avatarUrl.replace(OLD_PREFIX, NEW_PREFIX)
    : r.avatarUrl;
  const nextCover = r.coverImageUrl?.startsWith(OLD_PREFIX)
    ? r.coverImageUrl.replace(OLD_PREFIX, NEW_PREFIX)
    : r.coverImageUrl;

  if (nextAvatar === r.avatarUrl && nextCover === r.coverImageUrl) continue;

  // 改前逐张确认云上 200,避免把好 URL 换成坏 URL
  for (const u of [nextAvatar, nextCover]) {
    if (!u || !u.startsWith(NEW_PREFIX)) continue;
    const code = await reachable(u);
    if (code !== 200) {
      console.error(`✗ 云上不可达(${code}),跳过 ${r.name}: ${u}`);
      process.exit(1);
    }
  }

  await db
    .update(characters)
    .set({ avatarUrl: nextAvatar, coverImageUrl: nextCover })
    .where(eq(characters.id, r.id));

  touched++;
  console.log(`✓ ${r.name} (${r.id})`);
  if (nextAvatar !== r.avatarUrl) console.log(`    avatar → ${nextAvatar}`);
  if (nextCover !== r.coverImageUrl) console.log(`    cover  → ${nextCover}`);
}

console.log(`\n完成:更新 ${touched} 个角色。`);
process.exit(0);
