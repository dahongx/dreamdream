import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { resolve } from "node:path";

const build = await Bun.build({
  entrypoints: ["scripts/preview-mask-dialog.tsx"], target: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "preview-only-actions", setup(builder) {
    builder.onResolve({ filter: /^@\/(i18n\/client|components\/ui\/DialogProvider|lib\/masks\/actions)$/ }, args => ({ path: args.path, namespace: "preview" }));
    builder.onLoad({ filter: /.*/, namespace: "preview" }, args => ({ loader: "tsx", contents:
      args.path.includes("i18n") ? `import {zh} from ${JSON.stringify(resolve("src/i18n/zh.ts"))}; export const useI18n=()=>({dict:zh});` :
      args.path.includes("DialogProvider") ? "export const useDialog=()=>({confirm:async()=>window.confirm('仅删除演示数据？')});" :
      "export const setSessionActiveMaskAction=async(_,id)=>({ok:true,activeMaskId:id}); export const saveMaskAction=async(draft)=>({ok:true,mask:{...draft,id:draft.id??crypto.randomUUID(),isDefault:false}}); export const setDefaultMaskAction=async()=>({ok:true}); export const clearDefaultMaskAction=setDefaultMaskAction; export const unsetDefaultMaskAction=setDefaultMaskAction; export const deleteMaskAction=setDefaultMaskAction;"
    }));
  }}],
});
if (!build.success) throw new Error(String(build.logs));
const js = await build.outputs[0].text();
const source = (await Bun.file("src/app/globals.css").text()).replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../../src/components/chat/MaskDialog.tsx";');
const css = (await postcss([tailwind()]).process(source, { from: resolve("src/app/globals.css") })).css;
const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>面具交互预览</title><style>${css}</style><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`;
const server = Bun.serve({ hostname: "127.0.0.1", port: 4322, fetch(req) { return new URL(req.url).pathname === "/app.js" ? new Response(js, {headers:{"Content-Type":"text/javascript"}}) : new Response(html, {headers:{"Content-Type":"text/html;charset=utf-8"}}); }});
console.log(`Mask preview: http://127.0.0.1:${server.port}`);
