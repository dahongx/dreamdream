#!/usr/bin/env bun
/** Local component regression only. No database, model call, or message send. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RegexRule } from "../src/lib/db/schema";
import { buildMufySourceRuleEnvelope } from "../src/lib/import/mufy-source-rule-envelope";
import { buildIframeSrcdoc } from "../src/lib/regex/iframe-bridge";
import { applyRegexToSegments } from "../src/lib/regex/segments";

const job = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const captureScript = await readFile(
  resolve("scripts/export-mufy-rendered-opening.js"),
  "utf8",
);
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const captureScriptPage = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>公开 DOM 采集脚本（只读）</title></head><body><h1>公开 DOM 采集脚本（只读）</h1><p>固定文件 scripts/export-mufy-rendered-opening.js；本页只展示文本，不执行该脚本，不读取其他路径。</p><textarea id="capture-script" aria-label="公开 DOM 采集脚本" readonly rows="32" cols="120">${escapeHtml(captureScript)}</textarea></body></html>`;
const scope =
  "local-source-component-regression-only; not five-card end-to-end acceptance; synthetic media may deliberately fail";
type Case = {
  name: string;
  roleId: string;
  raw: string;
  [key: string]: unknown;
};
type ManifestRow = { roleId: string; name: string; runtimePath: string };
const fixture = JSON.parse(
  await readFile(
    resolve(job, "reply-fixtures/source-rules-browser-inputs-20261015.json"),
    "utf8",
  ),
) as { cases: Case[] };
const manifest = JSON.parse(
  await readFile(resolve(job, "manifest.json"), "utf8"),
) as { rows: ManifestRow[] };
if (fixture.cases.length !== 15 || manifest.rows.length !== 5)
  throw new Error("Expected exact 15 synthetic cases and five manifest cards");
const captures = new Map<string, unknown>();
const skins = new Map<string, string>();
const publicOpeningCases: Case[] = [];
for (const row of manifest.rows) {
  const runtime = JSON.parse(
    await readFile(resolve(row.runtimePath), "utf8"),
  ) as { sourceRules?: unknown; detail?: { data?: { greeting?: unknown; optimizationCode?: string } } };
  if (!runtime.sourceRules)
    throw new Error(`Missing source rules: ${row.roleId}`);
  captures.set(row.roleId, runtime.sourceRules);
  skins.set(row.roleId, runtime.detail?.data?.optimizationCode ?? "");
  if (["396e1ded-9bfc-42e4-9350-c04a33e52a0f", "66e284e0-bcc5-4104-88cd-909d5b52305d"].includes(row.roleId)) {
    const greeting = runtime.detail?.data?.greeting;
    if (typeof greeting !== "string" || !greeting.trim())
      throw new Error(
        "Missing real XSJ public greeting; refusing substituted content",
      );
    publicOpeningCases.push({
      name: row.roleId === "66e284e0-bcc5-4104-88cd-909d5b52305d" ? "FML-real-public-opening" : "XSJ-real-public-opening",
      roleId: row.roleId,
      raw: greeting,
      inputCategory: "real-public-opening",
      syntheticCoverageEligible: false,
      sourceField: "runtime.detail.data.greeting",
      validationPurpose:
        "Compare actual source-rule layout against the current frozen opening restoration; not synthetic future-reply coverage",
    });
  }
}
// Only reports component diagnostics; does not patch source styling or interact with UI.
const telemetry = `<script>(function(){function report(kind,value){parent.postMessage({type:'fixture-observation',kind:kind,value:value},'*');}window.addEventListener('error',function(e){report('error',{message:String(e.message||'resource-error'),tag:e.target&&e.target.tagName||null});},true);window.addEventListener('unhandledrejection',function(e){report('error',{message:String(e.reason&&e.reason.message||e.reason||'unhandled-rejection')});});document.addEventListener('securitypolicyviolation',function(e){report('csp',{directive:e.violatedDirective,blockedURI:e.blockedURI});});function measure(){if(!document.body)return;report('metrics',{width:innerWidth,height:innerHeight,bodyHeight:Math.ceil(document.body.getBoundingClientRect().height),horizontalOverflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth),detailsCount:document.querySelectorAll('details').length,expandedCount:document.querySelectorAll('details[open]').length,buttonCount:document.querySelectorAll('button,[role=button],summary').length,textLength:(document.body.innerText||'').length});}window.addEventListener('load',measure);window.addEventListener('resize',measure);document.addEventListener('toggle',measure,true);document.addEventListener('click',function(){setTimeout(measure,100);},true);})();</script>`;

const cases = [...fixture.cases, ...publicOpeningCases].map((item, index) => {
  const capture = captures.get(item.roleId);
  if (!capture) throw new Error(`Unknown fixture role: ${index}`);
  const envelope = buildMufySourceRuleEnvelope(capture, item.roleId, skins.get(item.roleId));
  const now = new Date();
  const rules: RegexRule[] = envelope
    ? [
        {
          ...envelope,
          id: `fixture-rule-${index}`,
          packId: "local-fixture",
          targetText: null,
          variableMapping: [],
          outputGuidance: null,
          enabled: true,
          visible: false,
          createdAt: now,
          updatedAt: now,
        },
      ]
    : [];
  const result = applyRegexToSegments(item.raw, rules);
  return {
    index,
    name: item.name,
    roleId: item.roleId,
    character: {
      id: item.roleId,
      name:
        manifest.rows.find((row) => row.roleId === item.roleId)?.name ??
        item.name,
    },
    scope,
    inputCategory: item.inputCategory ?? "synthetic-regression",
    syntheticCoverageEligible: item.syntheticCoverageEligible ?? true,
    expectations: Object.fromEntries(
      Object.entries(item).filter(
        ([key]) => !["raw", "roleId", "name"].includes(key),
      ),
    ),
    matchedRules: result.matchedRules,
    unmatchedRules: result.unmatchedRules,
    segments: result.segments.map((segment) =>
      segment.type === "html"
        ? segment
        : {
            type: "iframe",
            ruleId: segment.ruleId,
            ruleName: segment.ruleName,
            minHeight: segment.minHeight ?? 1,
            srcdoc: buildIframeSrcdoc({
              srcdoc: telemetry + segment.srcdoc,
              captureGroups: [],
            }),
          },
    ),
  };
});

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mufy 来源组件回归</title><style>
:root{--bg-base:#0b1220;--bg-elevated:#131b2b;--surface-solid:#26334a;--text-primary:#f0f4fa;--text-secondary:#b8c5d1;--border-subtle:rgba(184,197,209,.12);--semantic-warning:#fbbf24;--space-sm:8px;--space-md:16px;--space-lg:24px;--font-body-zh:system-ui,sans-serif;--font-display-zh:Georgia,'Songti SC',serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg-base);color:var(--text-primary);font-family:var(--font-body-zh)}header{padding:var(--space-md);border-bottom:1px solid var(--border-subtle);background:var(--bg-elevated)}h1{font-family:var(--font-display-zh);margin:0 0 var(--space-sm)}p{margin:var(--space-sm) 0;color:var(--text-secondary)}label,button{margin-right:var(--space-sm)}select,button{padding:var(--space-sm);background:var(--surface-solid);color:var(--text-primary);border:1px solid var(--border-subtle)}#nj_fixture_scroll{overflow-x:auto;padding:var(--space-md) 0}#nj_fixture_stage{width:390px;margin:0 auto;min-height:1px}iframe{display:block;width:100%;height:1px;min-height:1px;border:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;padding:var(--space-sm)}.plain{border-bottom:1px solid var(--border-subtle)}#nj_fixture_diagnostics{padding:var(--space-md)}#nj_fixture_draft{width:100%;min-height:80px;background:var(--bg-elevated);color:var(--text-primary)}.warning{color:var(--semantic-warning)}</style></head><body>
<header id="nj_fixture_header"><h1>来源组件回归</h1><p class="warning">仅本地合成组件测试，不是五张卡完整验收。示例媒体失败不代表素材已验收。</p><label>案例 <select id="nj_fixture_case" aria-label="选择案例"></select></label><button id="nj_fixture_mobile">390px</button><button id="nj_fixture_desktop">1280px</button><button id="nj_fixture_reload">重新加载</button><button id="nj_fixture_export">导出本次观察</button><p id="nj_fixture_status"></p></header>
<div id="nj_fixture_scroll"><main id="nj_fixture_stage"></main></div><section id="nj_fixture_diagnostics"><h2>只读草稿（永不发送）</h2><textarea id="nj_fixture_draft" readonly aria-label="只读草稿"></textarea><h2>匹配与观察</h2><pre id="nj_fixture_report"></pre></section>
<script>
'use strict';
let cases=[],current=null,width=390,events=[],frames=new Map(),ports=new Map(),componentState=new Map(),generation=0;
const select=document.getElementById('nj_fixture_case'),stage=document.getElementById('nj_fixture_stage'),draft=document.getElementById('nj_fixture_draft'),report=document.getElementById('nj_fixture_report'),status=document.getElementById('nj_fixture_status');
function record(kind,value,frameIndex){events.push({at:new Date().toISOString(),kind,frameIndex:frameIndex??null,value});if(events.length>500)events.shift();if(kind==='error'||kind==='csp'||kind==='sendMessage-rejected')console.error('[fixture]',kind,value);updateReport();}
function observation(){return {version:1,scope:${JSON.stringify(scope)},observedAt:new Date().toISOString(),caseIndex:current&&current.index,caseName:current&&current.name,roleId:current&&current.roleId,inputCategory:current&&current.inputCategory,syntheticCoverageEligible:current&&current.syntheticCoverageEligible,viewport:{innerWidth,innerHeight},componentWidth:stage.getBoundingClientRect().width,frameHeights:[...frames.values()].map((f)=>({index:f.index,width:f.element.getBoundingClientRect().width,height:f.element.getBoundingClientRect().height})),draft:draft.value,matchedRules:current&&current.matchedRules,unmatchedRules:current&&current.unmatchedRules,expectations:current&&current.expectations,events};}
function updateReport(){if(!current)return;report.textContent=JSON.stringify(observation(),null,2);status.textContent='案例 '+(current.index+1)+'/'+cases.length+' · '+current.name+' · '+current.inputCategory+' · 容器 '+stage.getBoundingClientRect().width+'px · '+frames.size+' 个真实沙箱 · 发送功能禁用';}
function init(frame){const old=ports.get(frame.index);if(old)old.close();const channel=new MessageChannel();ports.set(frame.index,channel.port1);channel.port1.onmessage=async function(event){const data=event.data||{},id=data.id,method=data.method,args=data.args||{};try{let result=null;switch(method){case 'fillComposer':draft.value=String(args.text||'');record('fillComposer',{length:draft.value.length},frame.index);break;case 'getHistory':result=[];break;case 'getCharacter':result=current.character;break;case 'setComponentState':componentState.set(frame.index,args.state);break;case 'sendMessage':record('sendMessage-rejected',{length:String(args.text||'').length},frame.index);throw new Error('Message sending is prohibited in local fixtures');default:throw new Error('Unknown fixture RPC');}channel.port1.postMessage({id,result});}catch(e){channel.port1.postMessage({id,error:String(e.message||e)});}};frame.element.contentWindow.postMessage({type:'init',context:{captureGroups:[],locale:'zh-CN',userName:'本平台测试玩家',ruleId:frame.ruleId,ruleName:frame.ruleName}},'*',[channel.port2]);}
window.addEventListener('message',function(event){const frame=frames.get(event.source);if(!frame||!event.data)return;const data=event.data;if(data.type==='nj_iframe_bridge_ready'){init(frame);return;}if(data.type==='resize'){const height=Number(data.height);if(Number.isFinite(height)&&height>0&&height<100000){frame.element.style.height=Math.max(frame.minHeight,Math.ceil(height))+'px';frame.element.dataset.height=String(height);updateReport();}}else if(data.type==='fixture-observation')record(String(data.kind),data.value,frame.index);});
function render(){generation++;for(const port of ports.values())port.close();ports.clear();frames.clear();componentState.clear();events=[];draft.value='';stage.replaceChildren();current=cases[Number(select.value)||0];if(!current)return;stage.style.width=width+'px';for(const [index,segment] of current.segments.entries()){if(segment.type==='html'){const plain=document.createElement('pre');plain.className='plain';plain.textContent=segment.content;stage.append(plain);continue;}const iframe=document.createElement('iframe');iframe.title=current.name+' · 组件 '+index;iframe.setAttribute('sandbox','allow-scripts');iframe.setAttribute('allow','autoplay');iframe.style.minHeight=(segment.minHeight||1)+'px';const frame={element:iframe,index,ruleId:segment.ruleId,ruleName:segment.ruleName,minHeight:segment.minHeight||1};iframe.addEventListener('load',function(){if(frames.get(iframe.contentWindow)===frame)init(frame);});stage.append(iframe);frames.set(iframe.contentWindow,frame);iframe.srcdoc=segment.srcdoc;}updateReport();history.replaceState(null,'','?case='+current.index+'&width='+width);}
select.addEventListener('change',render);document.getElementById('nj_fixture_mobile').onclick=function(){width=390;stage.style.width=width+'px';updateReport();};document.getElementById('nj_fixture_desktop').onclick=function(){width=1280;stage.style.width=width+'px';updateReport();};document.getElementById('nj_fixture_reload').onclick=render;document.getElementById('nj_fixture_export').onclick=function(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(observation(),null,2)],{type:'application/json'}));a.download='mufy-component-observation-'+current.index+'-'+width+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);};
fetch('/api/cases').then(r=>r.json()).then(function(data){cases=data;for(const c of cases){const o=document.createElement('option');o.value=String(c.index);o.textContent=(c.index+1)+'. '+c.name;select.append(o);}const params=new URLSearchParams(location.search);select.value=String(Math.min(cases.length-1,Math.max(0,Number(params.get('case'))||0)));width=params.get('width')==='1280'?1280:390;render();}).catch(function(e){status.textContent='加载失败：'+e.message;});
</script></body></html>`;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4317,
  fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.hostname !== "127.0.0.1")
      return new Response("Forbidden", { status: 403 });
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (url.pathname === "/capture-script" && !url.search)
      return new Response(captureScriptPage, {
        headers: {
          ...headers,
          "Content-Type": "text/html;charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; script-src 'none'; style-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
        },
      });
    if (url.pathname === "/")
      return new Response(html, {
        headers: {
          ...headers,
          "Content-Type": "text/html;charset=utf-8",
          // A srcdoc inherits host CSP. Do not add a second harness policy
          // that silently blocks assets allowed by buildIframeSrcdoc's CSP.
          // Author code still runs only inside its unchanged opaque sandbox.
        },
      });
    if (url.pathname === "/api/cases") return Response.json(cases, { headers });
    return new Response("Not found", { status: 404, headers });
  },
});
console.log(
  JSON.stringify({
    url: server.url.href,
    cases: cases.length,
    scope,
    databaseWrites: 0,
    sendMessage: "always-rejected",
    startedAt: new Date().toISOString(),
  }),
);
