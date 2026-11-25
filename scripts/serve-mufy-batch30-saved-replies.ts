/** Loopback development preview, not a TEST build; disallows all third-party requests. */
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {resolve} from 'node:path';
const composition=process.argv.includes('--candidate-composition');
const bundle=await Bun.build({entrypoints:[composition?'scripts/preview-mufy-candidate-composition-client.tsx':'scripts/preview-mufy-batch30-saved-replies-client.tsx'],target:'browser',define:{'process.env.NODE_ENV':'"development"'}});
if(!bundle.success)throw Error(String(bundle.logs));
const js=await bundle.outputs.find(out=>out.path.endsWith('.js'))!.text();
const bundleCss=await bundle.outputs.find(out=>out.path.endsWith('.css'))?.text()??'';
const css=(await postcss([tailwind()]).process('@import "tailwindcss" source(none);\n@source "../src/components/chat";\n@source "../src/components/regex/RegexIframe.tsx";',{from:resolve('scripts/saved-reply-preview.css')})).css;
const pageCss=':root{--bg-base:#0b1220;--text-primary:#f0f4fa;--accent-primary:#b8c5d1;--font-display-zh:serif;--space-md:16px}body{margin:0;background:var(--bg-base);color:var(--text-primary);font:16px/1.75 system-ui}header,main{max-width:700px;margin:24px auto;padding:var(--space-md)}h1{font-family:var(--font-display-zh);font-size:28px}button,textarea{border:1px solid var(--accent-primary);padding:8px;color:inherit;background:transparent}textarea{display:block;width:100%;min-height:48px}iframe{max-width:100%}';
const policy="default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; frame-src 'self' about: blob:; media-src 'none'";
const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){const path=new URL(request.url).pathname;if(path==='/app.js')return new Response(js,{headers:{'Content-Type':'text/javascript'}});if(path==='/preview.css')return new Response(bundleCss+css+pageCss,{headers:{'Content-Type':'text/css'}});if(path==='/')return new Response('<!doctype html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>已保存公开回复回放 · 本地未发布</title><link rel="stylesheet" href="/preview.css"></head><body><div id="preview-root"></div><script src="/app.js" type="module"></script></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':policy}});return new Response('Not found',{status:404});}});
console.log(JSON.stringify({url:'http://127.0.0.1:'+server.port,externalNetworkDisabled:true,modelCalls:0,databaseAccess:false,testServerBuildStarted:false}));
