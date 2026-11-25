/**
 * 生成 PWA 应用图标 —— 调用 gstack 的 Zeak 图像 API（~/.gstack/zeak-image-api.json）
 *
 * 产出：
 *   public/icon-source.png         1024x1024 原始
 *   public/apple-touch-icon.png    180x180
 *   public/icon-192.png            192x192
 *   public/icon-512.png            512x512
 *   public/icon-32.png             32x32
 *
 * 用法：bun run scripts/gen-app-icon.ts
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

interface ZeakConfig {
  endpoint: string;
  auth_token: string;
  default_model?: string;
}

const CONFIG_PATH = path.join(os.homedir(), ".gstack", "zeak-image-api.json");
const PROJECT_ROOT = path.resolve(import.meta.dir, "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");

function loadConfig(): ZeakConfig {
  // env vars 优先（一次性 key，不落盘）
  if (process.env.IMAGE_API_ENDPOINT && process.env.IMAGE_API_TOKEN) {
    return {
      endpoint: process.env.IMAGE_API_ENDPOINT,
      auth_token: process.env.IMAGE_API_TOKEN,
      default_model: process.env.IMAGE_API_MODEL ?? "gpt-image-2",
    };
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `No image API config: set IMAGE_API_ENDPOINT + IMAGE_API_TOKEN env vars, or write ${CONFIG_PATH}`,
    );
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

const PROMPT = `
App icon design, square 1024x1024, premium iOS app store quality.

Subject: a single round wax-letter seal centered in the frame, occupying about
55% of the icon's height. The seal is rich antique gold (#d4af37 with subtle
darker gold #9a7a1e shading), with a slightly molten, textured edge that
suggests cooled wax — irregular but elegant, not perfectly circular. Inside
the seal, a stamped impression of a thin crescent moon and a single delicate
curving stroke (like the tail of an ink brush), embossed inward, in a slightly
darker tone of the same gold.

Background: deep velvety purple-black, a soft radial gradient from #13091e at
the center to #0e0a1a at the edges. Behind the seal, a very faint violet glow
halo (#a78bfa at about 15% opacity), barely visible, suggesting candlelight
behind a letter.

Style: minimalist, iconic, instantly readable at 60x60 px. Generous padding
around the seal (about 18% margin from edges). No border, no frame, no text,
no Chinese characters, no English text, no extra ornaments. The seal should
have a tactile, slightly glossy quality — like real cooled sealing wax under
warm light, not flat 2D vector.

Mood: literary, intimate, romantic, slightly melancholic — like a private
letter you'd never send. Suitable for a Chinese-language AI companion app
about entrusting emotions to characters.
`.trim();

async function generate() {
  const cfg = loadConfig();

  console.log("[icon] calling image API…");
  console.log("[icon] endpoint:", cfg.endpoint);
  console.log("[icon] model:", cfg.default_model ?? "gpt-image-2");

  const authHeader = cfg.auth_token.startsWith("Bearer ")
    ? cfg.auth_token
    : `Bearer ${cfg.auth_token}`;

  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: PROMPT,
      n: 1,
      model: cfg.default_model ?? "gpt-image-2",
      size: "1024x1024",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image API ${res.status}: ${err.slice(0, 500)}`);
  }

  const raw = await res.json();
  console.log("[icon] raw response shape:", JSON.stringify(raw).slice(0, 400));
  const data = raw as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = data.data?.[0];
  if (!item) throw new Error("No image in response");

  let buf: Buffer;
  if (item.b64_json) {
    buf = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    console.log("[icon] downloading from URL…");
    const imgRes = await fetch(item.url);
    buf = Buffer.from(await imgRes.arrayBuffer());
  } else {
    throw new Error("Response has neither b64_json nor url");
  }

  const sourcePath = path.join(PUBLIC_DIR, "icon-source.png");
  fs.writeFileSync(sourcePath, buf);
  console.log(
    `[icon] saved source → ${sourcePath} (${(buf.length / 1024).toFixed(1)} KB)`,
  );

  const sizes: Array<{ name: string; size: number }> = [
    { name: "apple-touch-icon.png", size: 180 },
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "icon-32.png", size: 32 },
  ];

  for (const { name, size } of sizes) {
    const out = path.join(PUBLIC_DIR, name);
    await sharp(buf)
      .resize(size, size, { fit: "cover" })
      .png({ quality: 95 })
      .toFile(out);
    console.log(`[icon] wrote ${name} (${size}x${size})`);
  }

  console.log("[icon] done.");
}

generate().catch((err) => {
  console.error("[icon] failed:", err);
  process.exit(1);
});
