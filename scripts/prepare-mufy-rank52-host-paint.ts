/** Private source-observed paint addition; no owner write, import or deployment. */
import { readFile, writeFile } from "node:fs/promises";
import postcss from "postcss";
import { sanitizeAndScopeCss } from "../src/lib/styling/whitelist";
const started = performance.now();
const dir = "outputs/mufy-rank81-90-20261111/rank52-audit";
type Paint = {background:string;border:string;borderRadius:string;color:string;shadow:string;image:string};
const observation = JSON.parse(await readFile(`${dir}/source-painted-controls.json`, "utf8")) as {
  observedAt:string;sourceUrl:string;
  paint:{name:string;controls:Array<{id:string;paint?:Paint}>};
  note:{container:{background:string;border:string;radius:string;shadow:string};blocks:Array<{fontSize:string;lineHeight:string;color:string}>};
  input:{background:string;border:string;color:string;placeholder:string;radius:string;shadow:string};
};
if (observation.paint.name !== "束铭" || new URL(observation.sourceUrl).searchParams.get("roleId") !== "072efd0e-aa1b-4eeb-aba8-877857ddbc50") throw Error("ROLE_PAINT_BINDING_MISMATCH");
const button = observation.paint.controls.find(c=>c.id === "mufy_header_clarity_btn")?.paint;
const header = observation.paint.controls.find(c=>c.id === "mufy_chat_header")?.paint;
if (!button || !header || observation.note.blocks.length !== 1) throw Error("SOURCE_PAINT_INCOMPLETE");
const id = (name:string) => `#${name}`.repeat(11);
const names = ["nj_back_button","nj_mobile_drawer_btn","nj_review_btn","nj_header_more_btn","nj_stage_adjust_btn","nj_chat_input_replay_btn","nj_mask_btn","nj_chat_input_model_btn","nj_currency_switcher","nj_chat_send_button"];
const rules:string[]=[];
function rule(selector:string, values:Record<string,string>) {
  const result=postcss.rule({selector});
  for(const [prop,value] of Object.entries(values)) result.append(postcss.decl({prop,value,important:true}));
  rules.push(result.toString());
}
rule(names.map(id).join(","), {background:button.background,border:button.border,"border-radius":button.borderRadius,color:button.color,"font-family":'"Source Han Serif CN", serif'});
rule(names.map(name=>`${id(name)} span`).join(","), {"font-family":"inherit"});
// Preserve the platform's active-mask glow rather than masking it with base shadow.
rule(names.map(name=>name === "nj_mask_btn" ? `${id(name)}:not([data-active])` : id(name)).join(","), {"box-shadow":button.shadow});
rule(id("nj_mask_btn"), {"--nj-mask-active-color":button.background});
// The current detector also sees :not([data-active]) as authored active paint.
// Supply the same positive active affordance explicitly in this private theme.
const activeCss = `${id("nj_mask_btn")}[data-active] {outline:2px solid var(--nj-mask-active-color, currentColor)!important;outline-offset:1px!important;box-shadow:0 0 6px var(--nj-mask-active-color, currentColor)!important}`;
rules.push(activeCss);
rule(id("nj_chat_header"), {background:header.background,"background-image":header.image,border:header.border,"box-shadow":header.shadow});
const note=observation.note.container;
rule(id("nj_author_note"), {background:note.background,border:note.border,"border-radius":note.radius,"box-shadow":note.shadow});
const text=observation.note.blocks[0];
rule(`${id("nj_author_note")}>p.whitespace-pre-wrap`, {"font-family":'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',"font-size":text.fontSize,"line-height":text.lineHeight,color:text.color});
const input=observation.input;
rule(id("nj_chat_input_box"), {background:input.background,border:input.border,"border-radius":input.radius,"box-shadow":input.shadow});
rule(id("nj_chat_input_textarea"), {background:"transparent",border:"0", "box-shadow":"none",color:input.color});
rule(`${id("nj_chat_input_textarea")}::placeholder`, {color:input.placeholder});
const css=`/* RANK52_SOURCE_BLUE_PAINT: functional geometry/actions/labels unchanged. */\n${rules.join("\n")}`;
const checked=sanitizeAndScopeCss(css,"rank52-owner-paint");
if(checked.warnings.length) throw Error("SOURCE_PAINT_CSS_REJECTED:"+JSON.stringify(checked.warnings));
await writeFile(`${dir}/host-paint-addition-v2.css`,css);
await writeFile(`${dir}/mask-active-preservation-only.css`,activeCss);
await writeFile(`${dir}/host-paint-candidate-v2-audit.json`,JSON.stringify({observedAt:new Date().toISOString(),sourceObservedAt:observation.observedAt,sourceUrl:observation.sourceUrl,cssLength:css.length,warnings:checked.warnings,elapsedMs:performance.now()-started,ownerSaved:false,accepted:false,preservesActiveMaskGlow:true,sourceFontsEvidence:"source-fonts.json",supersedes:"host-paint-addition.css",reason:"Explicit positive mask active affordance avoids current :not selector detector ambiguity"},null,2));
console.log(JSON.stringify({cssLength:css.length,warnings:checked.warnings.length}));
