import type { MufyRoleDetail } from "./mufy-migration";

const responsive = `<style data-mufy-adaptation="mobile-box-model">
html{height:auto!important;min-height:0!important}body{height:auto!important;min-height:0!important;display:flow-root}
@media(max-width:480px){html,body{max-width:100%;margin:0}*,*::before,*::after{box-sizing:border-box}body>div,body>main,body>section{max-width:100%}img,video{max-width:100%}div,section,article,details,summary{min-width:0;max-width:100%;overflow-wrap:anywhere}}
</style><script data-mufy-adaptation="content-height">
(function(){if(window.__mufyContentHeightRepair)return;window.__mufyContentHeightRepair=true;var queued=false;function measure(){queued=false;if(!document.body)return;var h=Math.ceil(document.body.getBoundingClientRect().height);if(h>0)parent.postMessage({type:'resize',height:h},'*');}function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}function start(){if(window.ResizeObserver)new ResizeObserver(schedule).observe(document.body);schedule();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();window.addEventListener('load',schedule);window.addEventListener('resize',schedule);document.addEventListener('toggle',schedule,true);})();
</script>`;

/**
 * The auto-height reset above forces `body{display:flow-root}` so the host can
 * measure a shrink-wrapped canvas. When the author centered a component with
 * `body{display:flex;justify-content:center}`, that reset silently wins the
 * cascade and the component collapses against the left edge.
 *
 * Re-establish centering only when the author actually asked for it, and do it
 * with placement that survives a flow-root body. This never invents alignment
 * the source did not declare.
 */
export function preserveAuthorBodyCentering(html: string): string {
  const ownsFlexCenter =
    /body\s*\{[^}]*display\s*:\s*flex\b[^}]*\}/i.test(html) &&
    /body\s*\{[^}]*justify-content\s*:\s*center\b[^}]*\}/i.test(html);
  if (!ownsFlexCenter) return html;
  const override = `<style data-mufy-adaptation="author-body-centering">
body{display:flex!important;justify-content:center!important}
body>div,body>main,body>section,body>article{margin-left:auto!important;margin-right:auto!important}
</style>`;
  // Author CSS must be parsed first, so append after it and after our reset.
  return html + override;
}


function floating(html: string, panel?: string, trigger?: string): string {
  const relay =
    panel && trigger
      ? `<style>
${trigger}{right:0!important;bottom:0!important;top:auto!important;transform:none!important}
${panel}{inset:0!important;background:transparent!important}
${panel} .cen-sv-win,${panel} .cen-deck-win{right:0!important;bottom:0!important;width:100%!important;max-height:100%!important}
</style><details class="mufy-adapted-sidebar" hidden></details><script>
(function(){var panel=document.querySelector(${JSON.stringify(panel)}),flag=document.querySelector('.mufy-adapted-sidebar');if(!panel||!flag)return;function sync(){flag.toggleAttribute('open',getComputedStyle(panel).display!=='none');}new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['style','class']});sync();})();
</script>`
      : `<style>details.censy-nano-sidebar{top:50%!important;right:0!important}details.censy-nano-sidebar[open]{margin-right:0!important}</style>`;
  const audioState = `<script>(function(){var audio=document.getElementById('censy-nano-audio'),btn=document.getElementById('censy-nano-playbtn');if(audio&&btn&&!audio.getAttribute('src')){btn.disabled=true;btn.textContent='-';btn.title='Audio pending';btn.setAttribute('aria-label','Audio pending');}})();</script>`;
  return `<floating kind="details-right" pos="right-center" interactive="true">${html}\n${relay}\n${audioState}</floating>`;
}

function commandComponent(items: unknown): string | null {
  if (!items || typeof items !== "object") return null;
  const entries = (items as { items?: unknown }).items;
  if (!Array.isArray(entries)) return null;
  const actions: { name: string; prompt: string }[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as {
      isShow?: boolean;
      isLocked?: boolean;
      actions?: unknown;
    };
    if (
      item.isShow === false ||
      item.isLocked === true ||
      !Array.isArray(item.actions)
    )
      continue;
    for (const value of item.actions) {
      if (!value || typeof value !== "object") continue;
      const action = value as { actionName?: unknown; actionPrompt?: unknown };
      if (
        typeof action.actionName === "string" &&
        typeof action.actionPrompt === "string"
      )
        actions.push({ name: action.actionName, prompt: action.actionPrompt });
    }
  }
  if (!actions.length) return null;
  const escape = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  return `<floating kind="island" pos="top-center" interactive="true"><div class="island-container"><details class="mufy-command-menu"><summary>快捷指令</summary><p>点击填入输入框，确认后再发送。</p>${actions.map((a, i) => `<button type="button" data-command="${i}">${escape(a.name)}</button>`).join("")}<output></output></details></div>
<style>.mufy-command-menu{padding:var(--space-md,1rem);color:var(--text-primary);background:var(--surface-glass);border:1px solid var(--border-subtle);border-radius:var(--radius-md)}.mufy-command-menu button{margin:var(--space-xs,.25rem);padding:var(--space-sm,.5rem);color:inherit;background:transparent;border:1px solid var(--border-strong);border-radius:var(--radius-sm)}</style>
<script>(function(){var menu=document.querySelector('.mufy-command-menu');menu.addEventListener('toggle',function(){document.querySelector('.island-container').classList.toggle('expanded',menu.open);});var actions=${JSON.stringify(actions).replaceAll("<", "\\u003c")};document.querySelectorAll('[data-command]').forEach(function(btn){btn.addEventListener('click',function(){var a=actions[Number(btn.dataset.command)];window.host.fillComposer(a.prompt).then(function(){document.querySelector('output').textContent='已请求填入输入框，尚未发送';}).catch(function(){document.querySelector('output').textContent='填入失败，请重试';});});});})();</script></floating>`;
}

/** Deterministic compatibility recipes, never tied to a character name. */
export function adaptMufyRuntime(detail: MufyRoleDetail): {
  opening: string;
  component: string;
  repairs: string[];
} {
  let component = detail.codeRenderContent ?? "",
    opening = detail.greeting ?? "";
  const repairs: string[] = [];
  if (/<system>/i.test(opening)) {
    opening = opening.replace(/<(\/?)system>/gi, "<$1sys>");
    repairs.push("visual-system-is-not-prompt-metadata");
  }
  // Components on the same card must share one sidebar canvas. Separate
  // transparent collapsed iframes otherwise intercept each other's close buttons.
  const fences = [
    ...component.matchAll(/```html[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```/g),
  ];
  const settingFence = fences.find((m) =>
    m[1].includes('<template id="censy-setting-vue-permanent-v1"'),
  );
  const deckFence = fences.find((m) =>
    m[1].includes('<template id="censy-abyss-mp3-v3-permanent"'),
  );
  if (settingFence && deckFence) {
    const shared = `<style>*{box-sizing:border-box}#cen_mp3_trigger_wrap{top:0!important;bottom:auto!important;right:0!important}html[data-nj-floating-open="true"] #cen_sv_trigger_wrap,html[data-nj-floating-open="true"] #cen_mp3_trigger_wrap{display:none!important}#cen_mp3_deck_root{inset:0!important}#cen_mp3_deck_root .cen-deck-win{right:0!important;bottom:0!important;width:100%!important;max-height:100%!important}</style><script>(function(){var roots=[document.querySelector('#cen_sv_root'),document.querySelector('#cen_mp3_deck_root')],flag=document.querySelector('.mufy-adapted-sidebar');function sync(){if(flag)flag.toggleAttribute('open',roots.some(function(e){return e&&getComputedStyle(e).display!=='none';}));}roots.forEach(function(e){if(e)new MutationObserver(sync).observe(e,{attributes:true,attributeFilter:['style','class']});});sync();})();</script>`;
    const joined = floating(
      settingFence[1] + "\n" + deckFence[1],
      "#cen_sv_root",
      "#cen_sv_trigger_wrap",
    ).replace("</floating>", shared + "</floating>");
    component = component
      .replace(settingFence[0], "```html\n" + joined + "\n```")
      .replace(deckFence[0], "");
    repairs.push(
      "sandbox-setting-panel",
      "sandbox-mp3-deck",
      "shared-sidebar-hit-area",
    );
  }
  component = component.replace(
    /```html[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```/g,
    (block, html: string) => {
      let result = html;
      if (html.includes("<floating ")) return block;
      if (/<template\b[^>]*id=["']censy-eternal-nano-cloud["']/.test(html)) {
        result = floating(html);
        repairs.push("sandbox-cloud-player");
      } else if (
        /<template\b[^>]*id=["']censy-setting-vue-permanent-v1["']/.test(html)
      ) {
        result = floating(html, "#cen_sv_root", "#cen_sv_trigger_wrap");
        repairs.push("sandbox-setting-panel");
      } else if (
        /<template\b[^>]*id=["']censy-abyss-mp3-v3-permanent["']/.test(html)
      ) {
        // Use a different supported anchor to keep its collapsed hit box separate.
        result = floating(html, "#cen_mp3_deck_root", "#cen_mp3_trigger_wrap")
          .replace('kind="details-right"', 'kind="rose-right"')
          .replace('pos="right-center"', 'pos="top-right"')
          .replaceAll(
            'class="mufy-adapted-sidebar"',
            'class="mufy-adapted-sidebar ft-rose-details"',
          );
        repairs.push("sandbox-mp3-deck");
      } else {
        result = html + "\n" + responsive;
        if (/<div\b[^>]*class=["'][^"']*\bghost-sidebar-container\b/.test(html)) {
          result += `<script>(function(){var el=document.querySelector('.ghost-sidebar-container');if(!el)return;el.style.visibility='hidden';function sync(){window.host.getHistory().then(function(history){el.style.display=history.length?'':'none';el.style.visibility='';parent.postMessage({type:'resize',height:Math.max(1,Math.ceil(document.body.getBoundingClientRect().height))},'*');});}window.addEventListener('host-ready',sync);})();</script>`;
          repairs.push("host-sidebar-not-in-empty-preview");
        }
      }
      return "```html\n" + result + "\n```";
    },
  );
  // A single source fence may contain several standalone documents. The host
  // splits those documents, so a script appended after the fence reaches only
  // the last one. Bind the height contract inside each document as well.
  component = component.replace(/<\/body\s*>/gi, responsive + '</body>');
  // Some source cards put the sidebar after, not inside, an HTML fence. The
  // raw tail shares one sandbox with the theater; do not miss that path.
  if (component.includes('ghost-sidebar-container') && !repairs.includes('host-sidebar-not-in-empty-preview')) {
    component += `<style>.ghost-sidebar-container{visibility:hidden}</style><script>(function(){function sync(){var el=document.querySelector('.ghost-sidebar-container');if(!el)return;window.host.getHistory().then(function(history){el.style.display=history.length?'':'none';el.style.visibility='visible';});}window.addEventListener('host-ready',sync);if(window.host&&window.host.context)sync();})();</script>`;
    repairs.push('host-sidebar-not-in-empty-preview');
  }
  if (repairs.includes("sandbox-cloud-player"))
    opening = opening.replaceAll("<云朵播放器>", "");
  if (opening.includes("<定制指令组件正则>") && detail.renderedOpening) {
    // The source directive generator is not the inventory's quick-action menu.
    // Its captured inline template is rendered by the exact opening contract.
    repairs.push("source-inline-directive-generator-preserved");
  } else if (opening.includes("<定制指令组件正则>")) {
    const commands = commandComponent(detail.items);
    if (commands) {
      component += "\n```html\n" + commands + "\n```";
      opening = opening.replaceAll("<定制指令组件正则>", "");
      repairs.push("source-item-actions-to-composer");
    }
  }
  if (component !== detail.codeRenderContent) repairs.push("mobile-border-box");
  return { opening, component, repairs };
}
