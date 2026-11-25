/** Ephemeral loopback component dev preview; NOT a TEST/production build. */
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { resolve } from "node:path";
const companion=process.argv.includes('--companion');
const openingCopy=process.argv.includes('--opening-copy');
const openingMusic=process.argv.includes('--opening-music');
const nativeMeme=process.argv.includes('--native-meme');
const maskForm=process.argv.includes('--mask-form');
const fullscreenStory=process.argv.includes('--fullscreen-story');
const ghostInstructions=process.argv.includes('--ghost-instructions');
const prefix=process.argv.includes('--prefix');
const publicMap=process.argv.includes('--public-map');
const noMedia=process.argv.includes('--no-media');
const bundle = await Bun.build({
  entrypoints: [publicMap?'scripts/preview-mufy-public-map-client.tsx':prefix?'scripts/preview-mufy-prefix-client.tsx':ghostInstructions?'scripts/preview-mufy-ghost-instructions-client.tsx':fullscreenStory?'scripts/preview-mufy-fullscreen-story-client.tsx':maskForm?'scripts/preview-mufy-mask-form-client.tsx':nativeMeme?'scripts/preview-mufy-native-meme-client.tsx':openingMusic?'scripts/preview-mufy-inline-music-client.tsx':openingCopy?'scripts/preview-mufy-opening-copy-client.tsx':companion?'scripts/preview-mufy-composer-client.tsx':"scripts/preview-mufy-native-sidebar-client.tsx"],
  target: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
});
if (!bundle.success) throw Error(String(bundle.logs));
const js = await bundle.outputs
  .find((output) => output.path.endsWith(".js"))!
  .text();
const css = (
  await postcss([tailwind()]).process(
    '@import "tailwindcss" source(none);\n@source "../src/components/chat/OpeningSlot.tsx";\n@source "../src/components/chat/MufyNativeImageSidebar.tsx";\n@source "../src/components/chat/MufyComposerCompanion.tsx";\n@source "../src/components/chat/FloatingSlot.tsx";\n@source "../src/components/regex/RegexIframe.tsx";',
    { from: resolve("scripts/native-sidebar-preview.css") },
  )
).css;
const html =
  '<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>侧栏组件本地验收 · 未发布</title><link rel="stylesheet" href="/preview.css"></head><body><div id="preview-root"></div><script type="module" src="/app.js"></script></body></html>';
const pageCss =
  ":root{--bg-base:#0b1220;--text-primary:#f0f4fa;--accent-primary:#b8c5d1;--space-md:16px;--font-display-zh:serif}body{margin:0;background:var(--bg-base);color:var(--text-primary);font:16px/1.7 system-ui}main{max-width:700px;margin:80px auto;padding:var(--space-md)}h1{font-family:var(--font-display-zh);font-size:28px}button,textarea{border:1px solid var(--accent-primary);border-radius:4px;padding:8px;background:transparent;color:inherit}label,textarea{display:block}textarea{width:100%;min-height:180px;margin-top:16px}";
const companionCss=companion?'#nj_chat_input_box{position:fixed;bottom:24px;left:16px;right:16px;max-width:650px;margin:auto;padding:12px;border:1px solid var(--accent-primary);border-radius:4px;background:var(--bg-base)}#nj_chat_input_box textarea{min-height:70px;margin-top:4px}.preview-controls{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}':' '; 
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/app.js")
      return new Response(js, {
        headers: { "Content-Type": "text/javascript" },
      });
    if (path === "/preview.css")
      return new Response(css + pageCss + companionCss, {
        headers: { "Content-Type": "text/css" },
      });
    if (path === "/")
      return new Response(html, {
        headers: { "Content-Type": "text/html;charset=utf-8",...(noMedia?{"Content-Security-Policy":"media-src 'none';connect-src 'none'"}:{}) },
      });
    return new Response("Not found", { status: 404 });
  },
});
console.log(
  JSON.stringify({
    url: "http://127.0.0.1:" + server.port,
    scope: "isolated component development preview",
    testServerBuildStarted: false,
    databaseAccess: false,
    modelCalls: false,
  }),
);
