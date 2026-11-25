import { createHash } from "node:crypto";

export interface RenderedOpeningSourceBinding {
  roleId: string;
  greetingSha256: string;
  responseCode: 200;
  observedAt: string;
}

export interface RenderedOpeningCapture {
  version: 1;
  roleId: string;
  capturedAt: string;
  greetingSha256: string;
  html: string;
  frameCount: number;
  sourceBinding: RenderedOpeningSourceBinding;
}

/** Bind at source capture time, never by assigning a local runtime hash to an
 * already downloaded DOM snapshot. A hash alone is not response provenance. */
export function assertRenderedOpeningBinding(
  capture: RenderedOpeningCapture,
  roleId: string,
  greeting: string,
): void {
  const hash = createHash("sha256").update(greeting).digest("hex");
  const binding = capture.sourceBinding;
  const capturedTime = Date.parse(capture.capturedAt);
  const observedTime = binding && Date.parse(binding.observedAt);
  if (
    capture.version !== 1 ||
    capture.roleId !== roleId ||
    capture.greetingSha256 !== hash ||
    !binding ||
    binding.roleId !== roleId ||
    binding.greetingSha256 !== hash ||
    binding.greetingSha256 !== capture.greetingSha256 ||
    binding.responseCode !== 200 ||
    typeof capture.capturedAt !== "string" ||
    typeof binding.observedAt !== "string" ||
    !Number.isFinite(capturedTime) ||
    capturedTime <= 0 ||
    typeof observedTime !== "number" ||
    !Number.isFinite(observedTime) ||
    observedTime <= 0 ||
    observedTime > capturedTime + 60_000
  )
    throw new Error(
      "Rendered opening lacks a matching normal public detail response binding",
    );
}

/** A source-rendered opening is evidence for this exact opening, not a
 * replacement for unseen model replies or another version of the card. */
export function prepareRenderedOpening(
  capture: RenderedOpeningCapture,
  roleId: string,
  greeting: string,
  adaptedGreeting: string,
): { pattern: string; replacement: string } {
  assertRenderedOpeningBinding(capture, roleId, greeting);
  if (!capture.html.trim() || !Number.isFinite(Date.parse(capture.capturedAt)))
    throw new Error("Rendered opening capture is incomplete");
  // Captures run only in the existing no-same-origin iframe sandbox. Do not
  // carry source platform bridges or broaden its network/security policy.
  if (/__MUFY_ARTIFACT_BRIDGE__|<iframe\b/i.test(capture.html))
    throw new Error(
      "Rendered opening contains a source platform bridge or nested iframe",
    );
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Dearm's session seeder treats scenario/system as metadata, unlike Mufy's
  // visual system boxes. Match existing seeded openings without modifying
  // historical messages; the captured source restores the omitted boxes.
  const seedBody = (s: string) =>
    s.replace(/<(scenario|system)>([\s\S]*?)<\/\1>/gi, "").trim();
  const variants = [
    ...new Set([
      greeting.trim(),
      adaptedGreeting.trim(),
      seedBody(greeting),
      seedBody(adaptedGreeting),
    ]),
  ];
  // Legacy authors use a temporary textarea + execCommand, not only Clipboard
  // API. Route the selected value through the same no-send host action.
  const html = capture.html
    .replace(
      /(\b\w+)\.select\(\);\s*\b\w+\.execCommand\(['"]copy['"]\);/g,
      "$1.select(); window.host.fillComposer($1.value);",
    )
    .replace(/\$(?=[1-9])/g, "&#36;");
  return {
    pattern: "^\\s*(?:" + variants.map(escape).join("|") + ")\\s*$",
    replacement: `<artifact><style data-mufy-rendered-opening>html{height:auto!important;min-height:0!important}body{height:auto!important;min-height:0!important;display:flow-root;margin:0}*,*::before,*::after{box-sizing:border-box}img,video{max-width:100%}summary{cursor:pointer}.mufy-rendered-opening{display:flow-root;overflow-wrap:anywhere;max-width:100%}</style><div class="mufy-rendered-opening">${html}</div><script>
(function(){function names(){var name=window.host&&window.host.context.userName;if(!name)return;var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);var nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(function(n){if(!/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName))n.textContent=n.textContent.replace(/mufyer|\\{\\{user\\}\\}/gi,function(){return name;});});}window.addEventListener('host-ready',names);names();document.querySelectorAll('details').forEach(function(d){d.open=false;function signs(){d.querySelectorAll('summary [data-mufy-fold-sign]').forEach(function(e){e.textContent=d.open?'−':'+';});}signs();d.addEventListener('toggle',function(){signs();requestAnimationFrame(function(){parent.postMessage({type:'resize',height:Math.ceil(document.body.getBoundingClientRect().height)},'*');});});});})();
</script><style>.mufy-rendered-opening *{min-width:0;overflow-wrap:anywhere}#CEN_DG_MODAL{position:relative!important;inset:auto!important;max-width:100%!important;padding:12px 0;background:transparent!important}.cen-dg-card{max-width:calc(100% - 24px)!important;box-sizing:border-box}</style><script>(function(){var queued=false;function measure(){queued=false;var root=document.querySelector('.mufy-rendered-opening');if(root)parent.postMessage({type:'resize',height:Math.max(1,Math.ceil(root.getBoundingClientRect().height))},'*');}function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}function bindModal(){var modal=document.getElementById('CEN_DG_MODAL'),trigger=document.querySelector('.cen-dg-trigger-local');if(modal&&trigger&&modal.dataset.njBound!=='true'){modal.dataset.njBound='true';trigger.after(modal);schedule();}}new MutationObserver(bindModal).observe(document.body,{childList:true,subtree:true});bindModal();window.addEventListener('host-ready',bindModal);if(window.ResizeObserver)new ResizeObserver(schedule).observe(document.querySelector('.mufy-rendered-opening'));window.addEventListener('resize',schedule);window.addEventListener('load',schedule);document.addEventListener('toggle',schedule,true);document.querySelectorAll('img').forEach(function(e){e.addEventListener('load',schedule);});if(document.fonts)document.fonts.ready.then(schedule);schedule();})();</script></artifact>`,
  };
}
