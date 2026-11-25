import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import sharp from "sharp";

type RuntimeAsset = {
  url: string;
  ok: boolean;
  contentType: string | null;
  size: number | null;
  dataUrl: string | null;
  error: string | null;
};

type RuntimeSnapshot = {
  detail: unknown;
  assets: RuntimeAsset[];
  assetSummary: {
    discovered: number;
    embedded: number;
    failed: number;
    embeddedBytes: number;
  };
  repairRuns?: {
    startedAt: string;
    finishedAt: string;
    measuredExecutionMs: number;
    embeddedBefore: number;
    embeddedAfter: number;
    remainingFailed: number;
  }[];
};

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MEDIA_EXTENSIONS = /\.(?:avif|webp|png|jpe?g|gif|svg|mp3|m4a|wav|ogg)$/i;

function mediaUrls(value: unknown): string[] {
  const source = JSON.stringify(value);
  const urls = new Set<string>();
  for (const match of source.matchAll(/https?:\\?\/\\?\/[^\s"'<>`\\)]+/gi)) {
    const raw = match[0].replaceAll("\\/", "/").replace(/[;,]+$/, "");
    try {
      const parsed = new URL(raw);
      if (MEDIA_EXTENSIONS.test(parsed.pathname)) urls.add(parsed.href);
    } catch {
      // Ignore malformed author URLs; the migration report handles real gaps.
    }
  }
  return [...urls];
}

async function download(
  url: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url, {
    headers: {
      Referer: "https://chat.mufy.ai/",
      "User-Agent": "Mozilla/5.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType:
      response.headers.get("content-type")?.split(";")[0] ||
      "application/octet-stream",
  };
}

async function normalizeAsset(
  sourceUrl: string,
  candidates: string[],
): Promise<{ buffer: Buffer; contentType: string; fetchedFrom: string }> {
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      let { buffer, contentType } = await download(candidate);
      if (
        buffer.byteLength > MAX_ASSET_BYTES &&
        contentType.startsWith("image/")
      ) {
        buffer = await sharp(buffer).webp({ quality: 88 }).toBuffer();
        contentType = "image/webp";
      }
      if (buffer.byteLength > MAX_ASSET_BYTES) {
        throw new Error("asset exceeds 10 MiB after normalization");
      }
      return { buffer, contentType, fetchedFrom: candidate };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `${sourceUrl}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function main(): Promise<void> {
  const paths = process.argv.slice(2);
  if (paths.length === 0)
    throw new Error(
      "usage: bun scripts/repair-mufy-runtime-assets.ts <runtime.json>...",
    );

  for (const path of paths) {
    const repairStartedAt = new Date().toISOString();
    const repairStarted = performance.now();
    const snapshot = JSON.parse(
      await readFile(path, "utf8"),
    ) as RuntimeSnapshot;
    const embeddedBefore = snapshot.assets.filter((asset) => asset.ok).length;
    const discoveredUrls = mediaUrls(snapshot.detail);
    const byUrl = new Map(snapshot.assets.map((asset) => [asset.url, asset]));
    for (const url of discoveredUrls) {
      if (!byUrl.has(url)) {
        const asset: RuntimeAsset = {
          url,
          ok: false,
          contentType: null,
          size: null,
          dataUrl: null,
          error: "not captured by browser exporter",
        };
        snapshot.assets.push(asset);
        byUrl.set(url, asset);
      }
    }

    let totalBytes = snapshot.assets.reduce(
      (sum, asset) => sum + (asset.ok ? asset.size || 0 : 0),
      0,
    );
    for (const asset of snapshot.assets) {
      if (asset.ok) continue;
      const fileName = basename(new URL(asset.url).pathname).toLowerCase();
      const alternates = discoveredUrls.filter(
        (url) =>
          url !== asset.url &&
          basename(new URL(url).pathname).toLowerCase() === fileName,
      );
      try {
        const repaired = await normalizeAsset(asset.url, [
          asset.url,
          ...alternates,
        ]);
        if (totalBytes + repaired.buffer.byteLength > MAX_TOTAL_BYTES) {
          throw new Error("snapshot exceeds 40 MiB asset limit");
        }
        asset.ok = true;
        asset.contentType = repaired.contentType;
        asset.size = repaired.buffer.byteLength;
        asset.dataUrl = `data:${repaired.contentType};base64,${repaired.buffer.toString("base64")}`;
        asset.error =
          repaired.fetchedFrom === asset.url
            ? null
            : `recovered from ${repaired.fetchedFrom}`;
        totalBytes += repaired.buffer.byteLength;
      } catch (error) {
        asset.error = error instanceof Error ? error.message : String(error);
      }
    }

    snapshot.assetSummary = {
      discovered: snapshot.assets.length,
      embedded: snapshot.assets.filter((asset) => asset.ok).length,
      failed: snapshot.assets.filter((asset) => !asset.ok).length,
      embeddedBytes: totalBytes,
    };
    snapshot.repairRuns ??= [];
    snapshot.repairRuns.push({
      startedAt: repairStartedAt,
      finishedAt: new Date().toISOString(),
      measuredExecutionMs: performance.now() - repairStarted,
      embeddedBefore,
      embeddedAfter: snapshot.assetSummary.embedded,
      remainingFailed: snapshot.assetSummary.failed,
    });
    await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(path, snapshot.assetSummary);
  }
}

await main();
