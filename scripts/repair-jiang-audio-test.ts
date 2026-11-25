import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { uploadImageToR2 } from "../src/lib/r2/client";

// A deliberately test-only, single-component repair. Never substitute songs.
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://115.29.213.73:8000") {
  throw new Error("Refusing non-test storage destination");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Missing test DATABASE_URL");
const sql = postgres(databaseUrl, { max: 1 });
try {
  const rows =
    await sql`SELECT content FROM opening_components WHERE id='4e0d8b2f-6cde-4df3-a67e-666efb4e7f5f' AND pack_id='f375261c-d983-459e-a39a-18a34d542e63'`;
  if (rows.length !== 1) throw new Error("Expected one test component");
  const original = rows[0].content as string;
  await writeFile("/tmp/jiang-audio-before-20261012.html", original, {
    flag: "wx",
  });
  let content = original;
  for (const track of ["546219510", "1942576027"]) {
    const body = await readFile(`/tmp/${track}.mp3`);
    if (body.length < 10000) throw new Error("Audio download is too small");
    const { publicUrl } = await uploadImageToR2({
      key: `mufy-audit/jianghuai/20261012/${track}.mp3`,
      body,
      contentType: "audio/mpeg",
    });
    content = content.replaceAll(
      `https://music.163.com/song/media/outer/url?id=${track}.mp3`,
      publicUrl,
    );
  }
  const updated =
    await sql`UPDATE opening_components SET content=${content}, updated_at=now() WHERE id='4e0d8b2f-6cde-4df3-a67e-666efb4e7f5f' AND pack_id='f375261c-d983-459e-a39a-18a34d542e63' AND content=${original} RETURNING id`;
  if (updated.length !== 1)
    throw new Error("Component changed concurrently; not overwritten");
  console.log("Repaired test JiangHuai audio sources (2 original tracks)");
} finally {
  await sql.end();
}
