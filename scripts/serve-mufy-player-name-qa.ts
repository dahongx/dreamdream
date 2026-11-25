/** Real local rendering only. Public frozen source frame, no site/account/database/model calls. */
import {readFile} from 'node:fs/promises';
const started=performance.now();
const sourcePath='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/26/source-public-component-inventory.json';
const inventory=JSON.parse(await readFile(sourcePath,'utf8'));
if(inventory.rank!==26||!inventory.name.includes('简行舟'))throw Error('PUBLIC_SOURCE_IDENTITY_MISMATCH');
const frames=inventory.roots.flatMap((r:{frames:{html:string}[]})=>r.frames);
const matches=frames.filter((f:{html:string})=>f.html.includes('你喜欢银杏叶吗'));
if(matches.length!==1||/<script\b/i.test(matches[0].html))throw Error('EXPECTED_ONE_STATIC_PUBLIC_INTRO');
const source=matches[0].html as string;
const built=await Bun.build({entrypoints:['scripts/preview-mufy-player-name-client.tsx'],target:'browser',define:{__PUBLIC_FRAME__:JSON.stringify(source)},plugins:[{name:'deny-server-only',setup(build){build.onResolve({filter:/^server-only$/},()=>{throw Error('SERVER_CODE_FORBIDDEN_IN_FIXTURE');});}}]});
if(!built.success)throw Error(built.logs.map(String).join('\n'));
const code=await built.outputs[0].text();
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Public player identity QA</title><style>body{margin:16px;background:#222;color:white;--space-sm:8px}main{max-width:640px;margin:auto}input{font-size:16px;margin:12px}iframe{width:100%;border:0}.nj_chat_input_toolbar{display:flex;width:100%;max-width:640px;align-items:center;justify-content:flex-start;gap:var(--space-sm);margin:0 auto var(--space-sm)}.nj_chat_input_toolbar.flex-wrap{flex-wrap:wrap}.qa-native{height:40px;flex-shrink:0;padding:0;box-sizing:border-box}#nj_chat_input_box{border:1px solid silver;box-sizing:border-box;width:100%;height:54px}textarea{width:100%;height:100%;box-sizing:border-box;font-size:16px}</style><div id="root"></div><script type="module" src="/fixture.js"></script></html>';
const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){const path=new URL(request.url).pathname;if(path==='/fixture.js')return new Response(code,{headers:{'Content-Type':'text/javascript'}});if(path!=='/')return new Response('Not found',{status:404});return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none';script-src 'self' 'unsafe-inline';style-src 'unsafe-inline';frame-src about:;connect-src 'none';img-src 'none';media-src 'none';font-src 'none';base-uri 'none';form-action 'none'"}});}});
console.log(JSON.stringify({url:`http://127.0.0.1:${server.port}/`,publicSource:sourcePath,sourceSha256:new Bun.CryptoHasher('sha256').update(source).digest('hex'),bundleElapsedMs:performance.now()-started,externalNetwork:false,serverOnlyImportsAllowed:false}));
