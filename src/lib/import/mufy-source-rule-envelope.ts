import {
  applyMufySourceRules,
  MUFY_SOURCE_RULE_LIMITS,
  MUFY_SOURCE_ENVELOPE_PREFIX,
  type PreparedMufySourceRule,
} from "./mufy-source-rules";
import { sanitizeHtml } from "@/lib/sanitize";

// Data, never a JavaScript expression. Only this exact prefix selects the
// source pipeline; ordinary creator rules keep their existing semantics.
export { MUFY_SOURCE_ENVELOPE_PREFIX, buildMufySourceRuleEnvelope } from "./mufy-source-rules";

export function isMufySourceRuleEnvelope(replacement: string): boolean {
  return replacement.startsWith(MUFY_SOURCE_ENVELOPE_PREFIX) ||
    replacement.startsWith(MUFY_SOURCE_ENVELOPE_PREFIX.replace("\n", "\r\n"));
}

function parseEnvelope(replacement: string): { rules: PreparedMufySourceRule[]; skinCss: string } {
  if (replacement.length > MUFY_SOURCE_RULE_LIMITS.maxTotalRuleLength * 2)
    throw new Error("source-envelope-length-limit");
  let value: unknown;
  try {
    const headerLength=MUFY_SOURCE_ENVELOPE_PREFIX.length+(replacement.startsWith(MUFY_SOURCE_ENVELOPE_PREFIX)?0:1);
    value = JSON.parse(replacement.slice(headerLength));
  } catch {
    // Parser excerpts may contain author replacement code; expose a category.
    throw new Error("invalid-source-envelope-json");
  }
  if (!value || typeof value !== "object")
    throw new Error("invalid-source-envelope");
  const envelope = value as Record<string, unknown>;
  if (
    envelope.version !== 1 ||
    typeof envelope.roleId !== "string" ||
    !envelope.roleId ||
    !Array.isArray(envelope.rules)
  )
    throw new Error("invalid-source-envelope");
  if (envelope.rules.length > MUFY_SOURCE_RULE_LIMITS.maxRules)
    throw new Error("source-rule-count-limit");
  const ids = new Set<string>();
  const rules = envelope.rules.map((entry: unknown) => {
    if (!entry || typeof entry !== "object")
      throw new Error("invalid-prepared-source-rule");
    const rule = entry as Record<string, unknown>;
    for (const key of ["id", "name", "source", "flags", "replacement"])
      if (typeof rule[key] !== "string")
        throw new Error("invalid-prepared-source-rule");
    if (!rule.id || ids.has(rule.id as string))
      throw new Error("duplicate-source-rule-id");
    ids.add(rule.id as string);
    return rule as unknown as PreparedMufySourceRule;
  });
  const skinCss = envelope.skinCss ?? "";
  if (typeof skinCss !== "string" || skinCss.length > 1_048_576) throw new Error("invalid-source-skin");
  return { rules, skinCss };
}

export function applyMufySourceRuleEnvelope(raw: string, replacement: string) {
  if (raw.length > MUFY_SOURCE_RULE_LIMITS.maxInputLength)
    throw new Error("source-input-length-limit");
  const envelope = parseEnvelope(replacement);
  return { ...applyMufySourceRules(sanitizeMufyRawFences(raw), envelope.rules), skinCss: envelope.skinCss };
}

// This code runs only in the already sandboxed RegexIframe, never in the host.
// Only the known source textarea/document and named generator namespaces are
// relayed locally; arbitrary parent APIs remain unsupported. Username touches text
// nodes only (not URLs, script source, styles, or author HTML attributes).
const FRAME_ADAPTATION = `<style data-mufy-source-adaptation>html,body{height:auto!important;min-height:0!important}body{display:flow-root}@media(max-width:480px){html,body{max-width:100%;margin:0}*,*::before,*::after{box-sizing:border-box}img,video{max-width:100%}div,section,article,details,summary{min-width:0;max-width:100%;overflow-wrap:anywhere}}</style><script data-mufy-source-adaptation>(function(){var queued=false;function measure(){queued=false;if(document.body)parent.postMessage({type:'resize',height:Math.max(1,Math.ceil(document.body.getBoundingClientRect().height))},'*');}function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}function names(){var name=window.host&&window.host.context&&window.host.context.userName;if(!name||!document.body)return;var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[],n;while(n=walker.nextNode()){if(!n.parentElement||n.parentElement.closest('script,style,textarea,template'))continue;if(/mufyer|\\{\\{user\\}\\}/i.test(n.nodeValue))nodes.push(n);}nodes.forEach(function(n){n.nodeValue=n.nodeValue.replace(/mufyer|\\{\\{user\\}\\}/gi,function(){return name;});});schedule();}function start(){names();if(window.ResizeObserver)new ResizeObserver(schedule).observe(document.body);schedule();}window.addEventListener('host-ready',names);window.addEventListener('load',schedule);window.addEventListener('resize',schedule);document.addEventListener('toggle',schedule,true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();</script>`;

// The virtual textarea is a delta transport, not a copy of the host draft.
// Clear it synchronously before the next author action can append cached text.
const DRAFT_RELAY = `<div id="mufy_chat_input_box" hidden data-mufy-draft-relay><textarea aria-hidden="true" tabindex="-1"></textarea></div><script data-mufy-draft-relay>(function(){var draft=document.querySelector('#mufy_chat_input_box[data-mufy-draft-relay] textarea');draft.addEventListener('input',function(){if(!window.host||typeof window.host.fillComposer!=='function'){draft.dataset.relayError='host-not-ready';return;}var text=draft.value;draft.value='';if(!text)return;delete draft.dataset.relayError;try{Promise.resolve(window.host.fillComposer(text)).catch(function(){draft.dataset.relayError='composer-fill-failed';});}catch(e){draft.dataset.relayError='composer-fill-failed';}});})();</script>`;

const DYNAMIC_ADAPTATION = `<style data-mufy-generator-layout>#CEN_DG_MODAL{position:relative!important;inset:auto!important;max-width:100%!important;background:transparent!important}.cen-dg-card{max-width:100%!important;box-sizing:border-box}</style><script data-mufy-dynamic-adaptation>(function(){var pending=false;function sync(){pending=false;if(!document.body)return;var modal=document.getElementById('CEN_DG_MODAL'),trigger=document.querySelector('.cen-dg-trigger-local');if(modal&&trigger&&modal.previousElementSibling!==trigger)trigger.after(modal);var name=window.host&&window.host.context&&window.host.context.userName;if(name){var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n,nodes=[];while(n=walker.nextNode()){if(n.parentElement&&!n.parentElement.closest('script,style,textarea,template')&&/mufyer|\\{\\{user\\}\\}/i.test(n.nodeValue))nodes.push(n);}nodes.forEach(function(node){var replaced=node.nodeValue.replace(/mufyer|\\{\\{user\\}\\}/gi,function(){return name;});if(replaced!==node.nodeValue)node.nodeValue=replaced;});}}function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}function start(){new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});schedule();}window.addEventListener('host-ready',schedule);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();</script>`;

export function adaptMufySourceFrame(srcdoc: string): string {
  let adapted = srcdoc
    .replace(/\bwindow\.parent\.document\b/g, "document")
    .replace(
      /\bwindow\.parent\.HTMLTextAreaElement\b/g,
      "window.HTMLTextAreaElement",
    )
    .replace(
      /\bwindow\.parent\.(Tuan_init_OpenModal|Z_CONFIG_Next|cold_tank_ToggleGen|CEN_Final_Gen|Tuan_init_CloseModal|current_cen_iframe)\b/g,
      "window.$1",
    )
    .replace(
      /\btempTx\.select\(\);\s*\b\w+\.execCommand\(['"]copy['"]\);/g,
      "window.host.fillComposer(tempTx.value);",
    );
  // Insert the dedicated draft target before author scripts run, keeping all
  // writes inside this opaque-origin sandbox. This never clicks Send or calls
  // a message API. Other author textareas remain untouched.
  adapted = /<body\b[^>]*>/i.test(adapted)
    ? adapted.replace(/<body\b[^>]*>/i, (opening) => opening + DRAFT_RELAY)
    : DRAFT_RELAY + adapted;
  // Append to each complete document when a source fence contains several.
  return /<\/body\s*>/i.test(adapted)
    ? adapted.replace(
        /<\/body\s*>/gi,
        `${FRAME_ADAPTATION}${DYNAMIC_ADAPTATION}</body>`,
      )
    : adapted + FRAME_ADAPTATION + DYNAMIC_ADAPTATION;
}

export function splitMufySourceFrames(
  html: string,
  skinCss = "",
): Array<
  { type: "html"; content: string } | { type: "frame"; srcdoc: string }
> {
  // optimizationCode is captured either as CSS or as one/more <style> blocks.
  // Do not nest the latter inside a style element (that corrupts its first rule).
  const styleBlocks = [...skinCss.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)];
  const messageSkin = styleBlocks.length
    ? styleBlocks.map((match) => match[1]).join("\n")
    : skinCss;
  // Some source skins style semantic system boxes without a regex rule for
  // them. Preserve their original class contract, only when the skin declares
  // it; the complete document still passes the normal HTML sanitizer below.
  // Source meta scripts publish CSS used by later, non-fenced status HTML.
  // They must share one opaque-origin canvas, not separate iframe documents.
  // Sanitize the complete prose document once: per-fragment sanitization would
  // prematurely close native details/div elements spanning a source fence.
  const fence = /```html[^\S\r\n]*\r?\n([\s\S]*?)\r?\n[^\S\r\n]*```/gi;
  const fragments: string[] = [];
  let token = "mufy-source-trusted-fence";
  while (html.includes(token)) token += "-x";
  const proseHtml = html.replace(fence, (_block, source: string) => {
    const index = fragments.push(source) - 1;
    return `<span data-mufy-fence="${token}-${index}"></span>`;
  });
  if (!fragments.length) return [{ type: "html", content: html }];
  // A self-contained source component (mail/phone/etc.) has its own stylesheet.
  // Its original opaque frame never inherited the surrounding message skin.
  // Keep mixed prose/meta-script documents on the shared canvas below, but do
  // not inject a global `* { color:white!important }` into an isolated UI.
  const onlyFence = fragments.length === 1 &&
    proseHtml.replace(`<span data-mufy-fence="${token}-0"></span>`, "").trim() === "" &&
    /<style\b[^>]*>[\s\S]*?<\/style\s*>/i.test(fragments[0]);
  if (onlyFence) return [{ type: "frame", srcdoc: adaptMufySourceFrame(fragments[0]) }];
  const prose = /\.mufy_message_system\b/.test(messageSkin)
    ? proseHtml.replace(/<(system|sys)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi,
        '<div class="mufy_message_system">$2</div>')
    : proseHtml;
  const clean = sanitizeHtml(prose);
  let restored = 0;
  const merged = clean.replace(
    new RegExp(`<span data-mufy-fence="${token}-(\\d+)"></span>`, "g"),
    (_marker, index: string) => {
      restored++;
      return `<div data-mufy-source-code style="white-space:normal">${fragments[Number(index)]}</div>`;
    },
  );
  if (restored !== fragments.length)
    throw new Error("source-canvas-fence-context-unsupported");
  return [
    {
      type: "frame",
      srcdoc: adaptMufySourceFrame(
        `<style data-mufy-source-skin>.mufy-source-canvas :where(*){white-space:normal}${messageSkin.replace(/</g, "\\3c ")}</style><div id="mufy_chat_messages"><div class="mufy_message_text"><div class="mufy-source-canvas react-markdown" style="white-space:pre-wrap">${merged}</div></div></div><style data-mufy-message-surface>html:has(.mufy-source-canvas),body:has(.mufy-source-canvas){background:transparent!important}</style>`,
      ),
    },
  ];
}

/** Raw model HTML fences are not captured source programs. Never upgrade
 * their scripts simply because another source rule matches this message. */
export function sanitizeMufyRawFences(raw: string): string {
  return raw.replace(
    /```html[^\S\r\n]*\r?\n([\s\S]*?)\r?\n[^\S\r\n]*```/gi,
    (_block, html: string) => "```html\n" + sanitizeHtml(html) + "\n```",
  );
}
