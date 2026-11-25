/** Narrow repair from the saved public drawer, without reading source storage. */
import { readFile, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { normalizePublicFrameReplay } from "../src/lib/import/mufy-public-frame-replay";
import {
  nativeImageSidebarEnvelope,
  extractNativeImageSidebars,
} from "../src/lib/opening/native-image-sidebar";

const dir = "outputs/mufy-rank53-70-20261111/rank60";
const source = JSON.parse(await readFile(`${dir}/public-capture.json`, "utf8"));
const document = new JSDOM(source.greeting).window.document;
const drawer = document.querySelector("details.glass-sidebar-container");
const frame = drawer?.querySelector("iframe");
const image = drawer?.querySelector("summary img");
if (!drawer || !frame || !image) throw Error("Observed drawer missing");
const publicDoc = normalizePublicFrameReplay(
  frame.getAttribute("srcdoc") ?? "",
).html;
const memory = new JSDOM(publicDoc).window.document;
for (const id of ["list-imp", "list-long", "list-short"])
  if (!memory.getElementById(id))
    throw Error(`Missing public memory list: ${id}`);
// Compatibility reads only the host's normal displayed conversation API. It
// commits complete blocks, retaining the previous list while a reply streams.
const sync = `<script data-dearm-compat="completed-memory-block">(()=>{let last='';async function update(){if(!window.host?.getHistory)return;try{const history=await window.host.getHistory();let block='';for(let i=history.length-1;i>=0;i--){if(history[i].role!=='assistant')continue;const matches=[...String(history[i].content).matchAll(/<记忆板>([\\s\\S]*?)<\\/记忆板>/g)];if(matches.length){block=matches[matches.length-1][1];break}}if(!block||block===last)return;const xml=new DOMParser().parseFromString('<root>'+block+'</root>','application/xml');if(xml.querySelector('parsererror'))return;for(const [tag,id] of [['关键事件','list-imp'],['长期记忆','list-long'],['短期记忆','list-short']]){const node=xml.querySelector(tag),list=document.getElementById(id);if(!node||!list)continue;const text=node.textContent.trim();if(list.textContent.trim()===text)continue;const li=document.createElement('li');li.textContent=text;list.replaceChildren(li)}last=block}catch{}}window.addEventListener('host-ready',update);update();setInterval(update,1500)})();</script>`;
const spec = {
  version: 1 as const,
  shellHtml: `<details class="mufy-side-r glass-sidebar-container"><summary class="mufy-side-btn">${image.outerHTML.replace("sidebar-trigger-icon", "mufy-side-icon")}</summary><div class="mufy-side-panel"><div class="mufy-side-inner"><div data-nj-native-documents></div></div></div></details>`,
  // Keep the test site's composer reachable on short desktop viewports. The
  // source has an independent right rail; Dearm's composer extends farther right.
  css: ':host{pointer-events:none!important}.mufy-side-r{font-family:sans-serif;-webkit-tap-highlight-color:transparent;pointer-events:none!important}.mufy-side-btn{cursor:pointer;outline:none;user-select:none;pointer-events:auto!important}.mufy-side-btn::-webkit-details-marker{display:none}.mufy-side-panel{pointer-events:auto!important;max-height:max(120px,calc(80dvh - 184px))!important}',
  documents: [publicDoc.replace(/<\/body>/i, `<style data-dearm-observed-color-scheme>html{color-scheme:normal!important}</style>${sync}</body>`)],
  sourceBox: {
    topVh: 20,
    rightPx: 0,
    triggerWidth: 68,
    triggerHeight: 48,
    triggerInsetRight: 20,
    openWidth: 300,
    openHeight: 464,
    panelGapPx: 8,
  },
  framePresentation: { minHeight: 400, borderRadius: 4 },
};
const envelope = nativeImageSidebarEnvelope(spec);
if (extractNativeImageSidebars(envelope).sidebars.length !== 1)
  throw Error("Native envelope validation failed");
await writeFile(`${dir}/native-sidebar-v4.html`, envelope);
await writeFile(
  `${dir}/native-sidebar-v4-derivation.json`,
  JSON.stringify(
    {
      sourceUrl: source.sourceUrl,
      sourceObservedAt: source.observedAt,
      sourceAuthorRulesCaptured: false,
      geometryEvidence: "source-sidebar-geometry.json",
      compatibility:
        "complete memory XML block -> public list text nodes; music program remains isolated",
      requiresRuntimeCandidate: true,
      accepted: false,
    },
    null,
    2,
  ),
);
const rules = JSON.parse(
  await readFile(`${dir}/public-opening-v3-styled.json`, "utf8"),
);
const clock = document.querySelector(".a-wrap");
if (!clock || clock.querySelectorAll(".a-text").length !== 2)
  throw Error("Public clock template mismatch");
clock.querySelectorAll(".a-text")[0].textContent = "$1";
clock.querySelectorAll(".a-text")[1].textContent = "$2";
const clockCss = source.styles.filter((s: string) => s.includes(".a-wrap")).join("\n");
if (!clockCss) throw Error("Public clock style absent");
await writeFile(`${dir}/time-memory-compatibility-v4.json`, JSON.stringify([
  {ruleName:"迁移兼容：赫连烬野公开时间地点栏",regexPattern:"<时间栏>\\s*<时间>([\\s\\S]*?)</时间>\\s*<地点>([\\s\\S]*?)</地点>\\s*</时间栏>",replaceString:'<artifact><html data-nj-iframe-min-height="1"><head><style>'+clockCss+'</style><style>html,body{height:auto!important;min-height:0!important;margin:0!important;background:transparent!important}</style></head><body>'+clock.outerHTML+'</body></html></artifact>',enabled:true,visibility:false},
  {ruleName:"迁移兼容：赫连烬野记忆板留在侧栏",regexPattern:"<记忆板>[\\s\\S]*?</记忆板>",replaceString:"<!-- memory displayed in the fixed sidebar -->",enabled:true,visibility:false}
],null,2));
const rule = rules[0];
const markup = rule.replaceString
  .replace(/^<artifact>/, "")
  .replace(/<\/artifact>$/, "");
const replay = new JSDOM(markup).window.document;
const duplicate = replay.querySelector("details.glass-sidebar-container");
if (!duplicate) throw Error("Expected original embedded drawer");
duplicate.remove();
rule.replaceString =
  "<artifact>" + replay.documentElement.outerHTML + "</artifact>";
await writeFile(
  `${dir}/opening-without-embedded-sidebar-v4.json`,
  JSON.stringify([rule], null, 2),
);
console.log(
  JSON.stringify({
    documentLength: publicDoc.length,
    envelopeLength: envelope.length,
    openingReplacementLength: rule.replaceString.length,
    requiresRuntimeCandidate: true,
  }),
);
