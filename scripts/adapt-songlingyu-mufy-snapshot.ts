#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises";
import postcss from "postcss";

const DETAIL_PATH = "hot_0926/details/宋聆语-mufy-detail.json";

const LOST_PRIMARY_AUDIO =
  "https://img.heliar.top/file/1781034223017_M500001usEfX2PDXI1.mp3";
const LOST_MIRROR_AUDIO =
  "https://jp.tuchuangyun.top/autoupload/04u2Nnvmr600XT5cbj2_JtiO_OyvX7mIgxFBfDMDErs/20260711/mJAZ/M500001usEfX2PDXI1.mp3";
const FIRST_AVAILABLE_AUDIO =
  "https://jp.tuchuangyun.top/autoupload/04u2Nnvmr600XT5cbj2_JtiO_OyvX7mIgxFBfDMDErs/20260711/mxk8/M500001a6Ym30PJcDR.mp3";

const COMPOSER_PLACEHOLDER_CSS = `
<style data-nj-migration="songlingyu-composer-placeholder">
#mufy_chat_input_box {
  position: relative;
}
#mufy_chat_input_box textarea::placeholder {
  color: transparent !important;
}
#mufy_chat_input_box:has(textarea:placeholder-shown)::before {
  content: "好想对你表白› ꘍ ‹";
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(213, 229, 235, 0.65);
  font-size: 15px;
  letter-spacing: 1px;
  white-space: nowrap;
  z-index: 1;
}
#mufy_chat_input_box:focus-within::before {
  opacity: 0;
}
</style>`;

type MufySnapshot = {
  data?: {
    optimizationCode?: string;
    codeRenderContent?: string;
  };
};

function adaptStyle(css: string): string {
  const root = postcss.parse(css);

  root.walkAtRules((rule) => {
    if (rule.name === "import" || rule.name === "font-face") rule.remove();
  });

  root.walkRules((rule) => {
    const selectors = rule.selectors.flatMap((selector) => {
      const value = selector.trim();

      // Mufy shell-only decoration has no Dearm equivalent and must not leak
      // into the scoped character skin.
      if (
        value === ".sly-fold-title::-webkit-details-marker" ||
        (value.includes("group.flex.w-fit") && value.endsWith(" svg")) ||
        value.includes('div[class*="z-50 min-w-"]') ||
        value.includes("svg.lucide.lucide-circle-alert") ||
        value.includes("#root > div > div.relative.h-full") ||
        value.includes("100\\%\\)\\].flex-row.items-center.gap-3") ||
        value === "img[src='/chat-star.png']"
      ) {
        return [];
      }

      if (value === "*") return ["body"];
      if (value === 'div[style*="background-image"][class*="bg-cover"]') {
        return ["body"];
      }

      if (value.includes("#mufy_chat_input_box > div.relative.flex.w-full")) {
        if (value.includes("::before")) return [];
        if (value.endsWith("> button > svg")) {
          return ["#mufy_chat_send_button svg"];
        }
        if (value.endsWith("> button")) return ["#mufy_chat_send_button"];
        return ["#mufy_chat_input_box"];
      }

      return [value];
    });

    if (selectors.length === 0) rule.remove();
    else rule.selectors = selectors;
  });

  return root.toString();
}

function adaptOptimizationCode(value: string): string {
  const adapted = value.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open: string, css: string, close: string) =>
      `${open}\n${adaptStyle(css).trim()}\n${close}`,
  );
  if (adapted.includes('data-nj-migration="songlingyu-composer-placeholder"')) {
    return adapted;
  }
  return `${adapted.trim()}\n\n${COMPOSER_PLACEHOLDER_CSS}\n`;
}

function removeLostTrack(value: string): string {
  if (
    !value.includes(LOST_PRIMARY_AUDIO) &&
    !value.includes(LOST_MIRROR_AUDIO)
  ) {
    return value;
  }
  let output = value.replace(LOST_PRIMARY_AUDIO, FIRST_AVAILABLE_AUDIO);

  // Remove the unavailable first playlist row, then re-index the two rows
  // whose audio was successfully captured in the runtime snapshot.
  output = output.replace(
    /\s*<div class="sly-music-track-item sly-track-active" data-index="0">[\s\S]*?<\/div>\s*<\/div>(?=\s*<div class="sly-music-track-item" data-index="1">)/,
    "",
  );
  output = output
    .replace(/data-index="1"/g, 'data-index="0"')
    .replace(/data-index="2"/g, 'data-index="1"');
  output = output.replace(
    /\s*\{ name: "T\.F\.D", url: "https:\/\/jp\.tuchuangyun\.top\/[^"]+M500001usEfX2PDXI1\.mp3" \},?\s*/,
    "\n        ",
  );
  output = output.replace(LOST_MIRROR_AUDIO, FIRST_AVAILABLE_AUDIO);
  output = output.replace(
    /<div class="sly-music-title">T\.F\.D<\/div>/,
    '<div class="sly-music-title">그걸로도 충분해요</div>',
  );
  return output;
}

async function main(): Promise<void> {
  const snapshot = JSON.parse(
    await readFile(DETAIL_PATH, "utf8"),
  ) as MufySnapshot;
  if (!snapshot.data?.optimizationCode || !snapshot.data.codeRenderContent) {
    throw new Error("宋聆语详情快照缺少 optimizationCode 或 codeRenderContent");
  }

  snapshot.data.optimizationCode = adaptOptimizationCode(
    snapshot.data.optimizationCode,
  );
  snapshot.data.codeRenderContent = removeLostTrack(
    snapshot.data.codeRenderContent,
  );

  await writeFile(
    DETAIL_PATH,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
  console.log(`已适配 ${DETAIL_PATH}`);
}

await main();
