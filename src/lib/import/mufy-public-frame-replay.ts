/** CLI/staging only. Inert parsing, never execute captured author programs. */
import { JSDOM } from "jsdom";
import {hasPublicAvatarLibrary,hasPublicOcProfile,hasPublicEngravedOpening,hasPublicCommandCopy,hasPublicMaskExtraction} from '../regex/iframe-bridge';


/** This observed form exports two local UI handlers onto the Mufy parent.
 * Rebind only this exact self-contained form; never expose the real host. */
export function localizeKnownPublicMaskForm(input:string):{html:string;localized:boolean}{
 const dom=new JSDOM(input),doc=dom.window.document;
 const trigger=doc.getElementById('cm-title-trigger-v7'),copy=doc.getElementById('cm-copy-btn-v7');
 const known=!!doc.getElementById('censy-mask-form-v7-white')&&!!doc.getElementById('cm-form-content-v7')&&trigger?.getAttribute('onclick')==='window.parent.censyToggleMaskV7()'&&copy?.getAttribute('onclick')==='window.parent.censyExtractDataV7()';
 const programs=[...doc.scripts].map(s=>s.textContent??'').filter(s=>s.includes('const _pWindow_Z_CONFIG = window.parent;')&&s.includes('const d_Doc_Tuan_init = document;')&&s.includes('_pWindow_Z_CONFIG.censyToggleMaskV7 = function()')&&s.includes('_pWindow_Z_CONFIG.censyExtractDataV7 = function()')&&s.includes('temp_Cmtt.value = textToCopy;'));
 dom.window.close();
 if(!known||programs.length!==1)return {html:input,localized:false};
 let localizedPrograms=0;
 const html=input.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(all,attrs:string,code:string)=>{
  if(!code.includes('const _pWindow_Z_CONFIG = window.parent;')||!code.includes('_pWindow_Z_CONFIG.censyExtractDataV7 = function()'))return all;
  const copyCall="d_Doc_Tuan_init.execCommand('copy');";
  if(code.split(copyCall).length!==2)throw Error('KNOWN_MASK_COPY_BOUNDARY_CHANGED');
  localizedPrograms++;
  return `<script${attrs}>${code.replace('const _pWindow_Z_CONFIG = window.parent;','const _pWindow_Z_CONFIG = window;')}</script>`;
 }).replace('onclick="window.parent.censyToggleMaskV7()"','onclick="window.censyToggleMaskV7()"').replace('onclick="window.parent.censyExtractDataV7()"','onclick="window.censyExtractDataV7()"');
 if(localizedPrograms!==1||html===input)throw Error('KNOWN_MASK_LOCALIZATION_FAILED');
 return {html,localized:true};
}

/** Two observed source-only panel handlers. No generic parent substitution. */
export function localizeKnownPublicPanelHandlers(input:string):{html:string;localizedPanels:string[]}{
 const dom=new JSDOM(input),doc=dom.window.document;
 const signatures=[{name:'interview-v4',selector:'#xm-slider-v4',guard:'#xm-dots-v4',alias:'_parentWin_Tt',handler:'xmScrollV4',signature:"const slider_Ks = d_Obj.getElementById('xm-slider-v4');"},{name:'guide-xm-v3',selector:'.xm-guide-wrapper-v3',guard:'.xm-fold-item-v3',alias:'_pWindow_Mg_xm',handler:'censyToggleGuideXmV3',signature:"header_Sx.closest('.xm-guide-wrapper-v3')"},{name:'friend-v11',selector:'#censy-friend-v11-gray',guard:'#cenZone-collapse-v11',alias:'_winParent',handler:'censy_Action_Fold_V11',signature:'_winParent.censy_Action_Render_V11 = function(targetId)'}];
 let html=input;const localizedPanels:string[]=[];
 for(const s of signatures){
  const assignment=`const ${s.alias} = window.parent;`,exportMarker=`${s.alias}.${s.handler} = function(`;
  const programs=[...doc.scripts].map(p=>p.textContent??'').filter(p=>p.includes(assignment)&&p.includes(exportMarker)&&p.includes(s.signature));
  if(!doc.querySelector(s.selector)||!doc.querySelector(s.guard)||programs.length!==1)continue;
  const inline=`onclick="window.parent.${s.handler}(`;
  if(!html.includes(inline))continue;
  let count=0;html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(all,attrs:string,code:string)=>{if(!code.includes(assignment)||!code.includes(exportMarker)||!code.includes(s.signature))return all;count++;return `<script${attrs}>${code.replace(assignment,`const ${s.alias} = window;`)}</script>`;}).replaceAll(inline,`onclick="window.${s.handler}(`);
  if(count!==1)throw Error('KNOWN_PANEL_BOUNDARY_CHANGED');localizedPanels.push(s.name);
 }
 dom.window.close();return {html,localizedPanels};
}

export function localizeKnownPublicAuthorFold(input:string):{html:string;localized:boolean}{
 const dom=new JSDOM(input),doc=dom.window.document;
 const toggle=doc.querySelector('.cv7-toggle'),assignment='window.parent.cv7ToggleAuthor = function()';
 const scripts=[...doc.scripts].map(s=>s.textContent??'').filter(s=>s.includes(assignment)&&s.includes("document.getElementById('cv7AuthorFold')")&&s.includes("stage.classList.toggle('open')"));
 const known=!!doc.getElementById('cv7AuthorFold')&&toggle?.getAttribute('onclick')==='window.parent.cv7ToggleAuthor()'&&scripts.length===1;dom.window.close();
 if(!known)return {html:input,localized:false};
 let count=0;const html=input.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(all,attrs:string,code:string)=>{if(!code.includes(assignment)||!code.includes("document.getElementById('cv7AuthorFold')"))return all;count++;return `<script${attrs}>${code.replace(assignment,'window.cv7ToggleAuthor = function()')}</script>`;}).replace('onclick="window.parent.cv7ToggleAuthor()"','onclick="window.cv7ToggleAuthor()"');
 if(count!==1)throw Error('KNOWN_AUTHOR_FOLD_BOUNDARY_CHANGED');return {html,localized:true};
}

/** Exact exporter defect: a continuation fence inside an unclosed document.
 * Do not remove ordinary document boundaries, prose fences or unknown scripts.
 */
export function repairPublicOpeningContinuationFence(input:string):{html:string;removed:number}{
 const marker='\n```html\n<script>\n(function(){\n  try {\n    const pDoc = window.parent.document;';
 let html=input,removed=0,offset=0;
 for(;;){const at=html.indexOf(marker,offset);if(at<0)break;
  const precedingFence=html.lastIndexOf('```html',at-1),prefix=html.slice(precedingFence,at);
  if(precedingFence>=0&&/<!doctype\s|<html[\s>]/i.test(prefix)&&!/<\/html\s*>/i.test(prefix)){
   html=html.slice(0,at)+marker.replace('```html\n','')+html.slice(at+marker.length);removed++;offset=at+marker.length-8;
  }else offset=at+marker.length;
 }
 return {html,removed};
}

export function normalizePublicFrameReplay(input: string): {
  html: string;
  removedGeneratedGalleryNodes: number;
  removedPlatformScripts: number;
  resetCapturedMediaProgress: number;
  removedGeneratedFriendNodes: number;
  resetCapturedPhoneInitialization: number;
} {
  const dom = new JSDOM(input);
  // These observed components copy public text/URLs rather than chat commands.
  // The finite renderer bridge owns their write-only clipboard acknowledgement.
  // Do not silently convert them into draft writes during future staging.
  const preservePublicClipboard=hasPublicAvatarLibrary(input)||hasPublicOcProfile(input)||hasPublicEngravedOpening(input)||hasPublicCommandCopy(input)||hasPublicMaskExtraction(input);
  let removedPlatformScripts = 0,
    removedGeneratedGalleryNodes = 0,
    resetCapturedMediaProgress = 0,
    removedGeneratedFriendNodes = 0,
    resetCapturedPhoneInitialization = 0;
  const adaptCode = (code: string) =>
    preservePublicClipboard ? code : code
      .replace(
        /navigator\.clipboard\.writeText\s*\(/g,
        "window.host.fillComposer(",
      )
      .replace(
        /(\b\w+)\.select\(\);\s*\b\w+\.execCommand\(['"]copy['"]\);/g,
        "$1.select(); window.host.fillComposer($1.value);",
      )
      .replace(
        /(\b([A-Za-z_$][\w$]*)\.select\(\);\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\.execCommand\(['"]copy['"]\);/g,
        "$1$3 $4 = (window.host.fillComposer($2.value), true);",
      );
  for (const script of dom.window.document.querySelectorAll("script")) {
    if (
      /__MUFY_ARTIFACT_BRIDGE__|__MUFY_CLOSE_INITIAL_CONTEXT__|Network requests are blocked in sandbox/.test(
        script.textContent ?? "",
      )
    ) {
      script.remove();
      removedPlatformScripts++;
    } else script.textContent = adaptCode(script.textContent ?? "");
  }
  const programs = [...dom.window.document.querySelectorAll("script")]
    .map((script) => script.textContent ?? "")
    .join("\n");
  // Event listeners do not survive serialization. This exact public phone
  // deliberately skips initialized wrappers, so reset only its captured flag.
  if(programs.includes("document.querySelectorAll('.fox-phone-wrapper:not(.initialized)')")&&programs.includes('const sendToUI = (text = "") => {')&&programs.includes("t.closest('.quick-btn, .action-btn').dataset.cmd")){
    for(const wrapper of dom.window.document.querySelectorAll('.fox-phone-wrapper.initialized')){wrapper.classList.remove('initialized');resetCapturedPhoneInitialization++;}
  }
  // This exact public friend-list generator assigns onclick closures, which
  // cannot survive a serialized DOM snapshot. Recreate only its own children.
  if(programs.includes('const Z_DATA_V11 = [')&&programs.includes('const init_List_V11 = function()')&&programs.includes("if(domList.children.length > 0) return;")&&programs.includes("btn.onclick = () => _winParent.censy_Action_Render_V11(item.id)")){
    const list=dom.window.document.getElementById('cenList-v11');
    if(!list)throw Error('SOURCE_FRIEND_LIST_MISSING');
    removedGeneratedFriendNodes=list.children.length;list.replaceChildren();
  }
  // A DOM snapshot can contain yesterday's playback percentage while the
  // replay program creates a brand-new detached Audio at time zero. Reset only
  // this observed player's serialized progress; its real timeupdate owns it.
  if(programs.includes('audio.ontimeupdate')&&programs.includes('audio.currentTime / audio.duration')&&programs.includes('shard-progress-bar')&&dom.window.document.getElementById('censy-shard-player')){
    const progress=dom.window.document.getElementById('shard-progress-bar');
    if(progress&&progress.style.width&&progress.style.width!=='0%'){
      progress.style.width='0%';resetCapturedMediaProgress++;
    }
  }
  // Serialized runtime DOM cannot serialize d.onclick closures. Only the known
  // gallery generator can safely regenerate these exact nodes from its array.
  if (
    programs.includes("function renderGrid") &&
    programs.includes("renderGrid(coupleImgs, 'qtGridCouple', 'qtCountCouple')")
  ) {
    const grid = dom.window.document.getElementById("qtGridCouple");
    if (!grid) {
      dom.window.close();
      throw Error("SOURCE_GALLERY_GRID_MISSING");
    }
    removedGeneratedGalleryNodes = grid.children.length;
    grid.replaceChildren();
  }
  for (const node of dom.window.document.querySelectorAll("*"))
    for (const attribute of [...node.attributes])
      if (/^on/i.test(attribute.name))
        node.setAttribute(attribute.name, adaptCode(attribute.value));
  const html = localizeKnownPublicAuthorFold(localizeKnownPublicPanelHandlers(localizeKnownPublicMaskForm(dom.window.document.documentElement.outerHTML).html).html).html;
  dom.window.close();
  return { html, removedGeneratedGalleryNodes, removedPlatformScripts, resetCapturedMediaProgress, removedGeneratedFriendNodes, resetCapturedPhoneInitialization };
}
