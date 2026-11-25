import { openingComponentPresentation } from '../src/lib/import/mufy-component-presentation';
import { buildIframeSrcdoc } from '../src/lib/regex/iframe-bridge';

// Local, synthetic fixtures only: no account, remote assets, generation or DB.
const hostSkin = '[data-character-css="opening"]{color:#f4f4f4!important;text-shadow:0 1px 3px #000!important}';
const source = `<style>body{font:16px/1.6 system-ui;margin:0}.panel{padding:18px;margin:12px;border-radius:8px}.light{background:#f7f7f7}.dark{background:#2a2a2a;color:#d0d0d0;text-shadow:none}.glass{background:rgba(255,255,255,.65);color:#262626;text-shadow:none}</style><section class="panel light"><strong>浅色面板 / 默认文字</strong><div>这段文字没有指定颜色，应使用来源默认黑色。</div></section><section class="panel dark"><strong>作者指定的深色面板</strong><div>灰色文字与深色背景应保持不变。</div></section><section class="panel glass"><strong>作者指定的半透明面板</strong><div>明确设置的前景色与透明度应保持不变。</div></section>`;
const escapeAttr = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const documents = [
  ['来源基准（合成样例）', `<!doctype html><style>html{color-scheme:dark}body{color:black}</style>${source}`],
  ['目前：整页主题注入', buildIframeSrcdoc({srcdoc:openingComponentPresentation(source,hostSkin,false),captureGroups:[],cssScope:'opening'})],
  ['试修：组件样式隔离', buildIframeSrcdoc({srcdoc:openingComponentPresentation(source,hostSkin,true),captureGroups:[],cssScope:'opening'})],
];
const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>美化颜色隔离 · 本地试验</title><style>html{color-scheme:dark}body{margin:24px;background:#0b1220;color:#f0f4fa;font:16px/1.6 system-ui}h1{font-size:24px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}iframe{width:100%;height:460px;border:1px solid #64748b}h2{font-size:17px}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>美化颜色隔离：本地对照试验</h1><p>合成测试样例，不代表任何真实角色卡已验收。没有修改 8091。</p><main>${documents.map(([title,doc],i)=>`<section><h2>${title}</h2><iframe title="color-${i}" sandbox="allow-scripts" srcdoc="${escapeAttr(doc)}"></iframe></section>`).join('')}</main></html>`;
const server = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}})});
console.log(`http://127.0.0.1:${server.port}`);
