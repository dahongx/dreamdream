/** Loopback-only UI fixture. Does not request any remote site or model. */
import {collectMufySharedComponentStyle} from '../src/lib/import/mufy-shared-component-style';
const build=await Bun.build({entrypoints:['scripts/mufy-stream-replay-client.tsx'],target:'browser',define:{'process.env.NODE_ENV':'"development"'}});
if(!build.success)throw Error(String(build.logs));
const js=await build.outputs[0].text();
const source=await Bun.file('logs/mufy-profiles/full-20261013/pilot-5/char_6e3124e6065bbcd98988/mufy-runtime-rendered-20261015.json').json();
const css=collectMufySharedComponentStyle([{content:source.detail.data.codeRenderContent}]);
Bun.serve({hostname:'127.0.0.1',port:18083,fetch(req){const path=new URL(req.url).pathname;if(path==='/app.js')return new Response(js,{headers:{'Content-Type':'text/javascript'}});if(path==='/public-style.json')return Response.json({css});if(path!=='/')return new Response('Not found',{status:404});return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b1220;color:#f0f4fa;font:16px system-ui;margin:16px}button{padding:10px;margin:5px}output{display:block;white-space:pre-wrap}iframe{border:0}</style><div id="app"></div><script type="module" src="/app.js"></script>',{headers:{'Content-Type':'text/html'}});}});
console.log('Local synthetic stream replay: http://127.0.0.1:18083');
