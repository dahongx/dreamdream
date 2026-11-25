import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import {
  attachMufyGhostPlayer,
  type MufyPlayerTrack,
} from "../src/lib/import/mufy-ghost-player";
import { uploadImageToR2 } from "../src/lib/r2/client";

interface RecoveredTrack extends MufyPlayerTrack {
  id: string;
  file: string;
  error: string | null;
}

const componentId = "83dce30b-197f-4b63-b858-34fb4758198a";
const packId = "b2d0bba8-98d3-47f7-bd8d-762e96887eaa";
const args = process.argv.slice(2);

if (args[0] === "--prepare") {
  const source = await Bun.file(args[1] ?? "mufy-six-role-details.json").json();
  const code = source.cards?.沈知衡?.body?.data?.codeRenderContent;
  if (typeof code !== "string")
    throw new Error("Missing original Shen player source");
  const directory = args[2] ?? "output/mufy-recheck/shen-audio";
  await mkdir(directory, { recursive: true });
  const tracks: RecoveredTrack[] = [
    ...code.matchAll(
      /\{\s*n:\s*"([^"\n]+)",\s*u:\s*"(https?:\/\/music\.163\.com\/song\/media\/outer\/url\?id=(\d+)\.mp3)"\s*\}/g,
    ),
  ].map((match) => ({
    name: match[1],
    url: match[2],
    id: match[3],
    file: `${match[3]}.mp3`,
    error: null,
  }));
  if (tracks.length !== 16)
    throw new Error("Expected the 16-track archived playlist");
  // Download source assets; do not execute any script from the archived card.
  for (let start = 0; start < tracks.length; start += 4) {
    await Promise.all(
      tracks.slice(start, start + 4).map(async (track) => {
        try {
          const result = Bun.spawn(
            [
              "curl.exe",
              "-fsSL",
              "--max-time",
              "45",
              "--retry",
              "1",
              track.url,
              "-o",
              join(directory, track.file),
            ],
            { stdout: "ignore", stderr: "pipe" },
          );
          const error = await new Response(result.stderr).text();
          if ((await result.exited) !== 0) throw new Error(error.trim());
          const bytes = await readFile(join(directory, track.file));
          if (
            bytes.length < 10000 ||
            !(
              (bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) ||
              (bytes[0] === 255 && (bytes[1] & 224) === 224)
            )
          ) {
            throw new Error("Source did not return an MP3");
          }
        } catch (error) {
          track.error = error instanceof Error ? error.message : String(error);
        }
        console.log(
          `${track.id} ${track.name}: ${track.error ?? "MP3 recovered"}`,
        );
      }),
    );
  }
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify({ sourceExportedAt: source.exportedAt, tracks }, null, 2),
  );
} else if (args[0] === "--rebind") {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://115.29.213.73:8000" ||
    !process.env.DATABASE_URL
  )
    throw new Error("Expected test environment");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const rows =
      await sql`SELECT content FROM opening_components WHERE id=${componentId} AND pack_id=${packId}`;
    if (rows.length !== 1)
      throw new Error("Expected one test Shen player component");
    const original = rows[0].content as string;
    const payload = original.match(/const tracks = (\[[^\n]+\]);/);
    if (!payload) throw new Error("Missing previously recovered playlist");
    const content = attachMufyGhostPlayer(
      original,
      JSON.parse(payload[1]) as MufyPlayerTrack[],
    );
    const updated =
      await sql`UPDATE opening_components SET content=${content}, updated_at=now() WHERE id=${componentId} AND pack_id=${packId} AND content=${original} RETURNING id`;
    if (updated.length !== 1) throw new Error("Concurrent modification");
    console.log(
      "Rebound existing test player playlist inside its floating iframe",
    );
  } finally {
    await sql.end();
  }
} else if (args[0] === "--apply") {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://115.29.213.73:8000")
    throw new Error("Refusing non-test storage destination");
  if (!process.env.DATABASE_URL) throw new Error("Missing test DATABASE_URL");
  const directory = args[1];
  if (!directory) throw new Error("Missing prepared asset directory");
  const manifest = JSON.parse(
    await readFile(join(directory, "manifest.json"), "utf8"),
  ) as { tracks: RecoveredTrack[] };
  if (manifest.tracks.length !== 16)
    throw new Error("Unexpected archived playlist size");
  const recovered = manifest.tracks.filter((track) => !track.error);
  if (recovered.length === 0)
    throw new Error("No playable source tracks recovered");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const rows =
      await sql`SELECT content FROM opening_components WHERE id=${componentId} AND pack_id=${packId}`;
    if (rows.length !== 1)
      throw new Error("Expected one test Shen player component");
    const original = rows[0].content as string;
    if (original.includes('id="nj-recovered-ghost-player"'))
      throw new Error("Player already restored");
    await writeFile("/tmp/shen-player-before-20261012.html", original, {
      flag: "wx",
    });
    const tracks: MufyPlayerTrack[] = [];
    for (const track of recovered) {
      const { publicUrl } = await uploadImageToR2({
        key: `mufy-audit/shenzhiheng/20261012/${track.id}.mp3`,
        body: await readFile(join(directory, track.file)),
        contentType: "audio/mpeg",
      });
      tracks.push({ name: track.name, url: publicUrl });
    }
    const content = attachMufyGhostPlayer(original, tracks);
    const updated =
      await sql`UPDATE opening_components SET content=${content}, updated_at=now() WHERE id=${componentId} AND pack_id=${packId} AND content=${original} RETURNING id`;
    if (updated.length !== 1)
      throw new Error("Component changed concurrently; not overwritten");
    console.log(
      `Restored test Shen player with ${tracks.length} original tracks`,
    );
    for (const track of manifest.tracks.filter((track) => track.error)) {
      console.log(
        `Unavailable original track retained in recovery report: ${track.name}`,
      );
    }
  } finally {
    await sql.end();
  }
} else {
  throw new Error(
    "Use --prepare <source.json> <asset-dir>, --apply <asset-dir>, or --rebind (writes are test-only)",
  );
}
