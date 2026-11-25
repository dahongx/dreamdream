/** Legacy source-player tokens are text, never HTML or script substitutions. */
export const MUFY_PLAYER_NAME_BINDING = `<script data-nj-mufy-player-binding>
(function(){
  var templates=new WeakMap(),queued=false;
  var token=/\\bmufyer\\b|\\{\\{\\s*user\\s*\\}\\}/gi;
  function sync(){
    queued=false;
    var name=window.host&&window.host.context&&window.host.context.userName;
    if(typeof name!=='string'||!name.trim()||!document.body)return;
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),node;
    while(node=walker.nextNode()){
      if(!node.parentElement||node.parentElement.closest('script,style,textarea,template,code,pre,kbd,samp,a[rel="author"],[data-mufy-source-credit],[contenteditable="true"]'))continue;
      var prior=templates.get(node),original=prior&&node.data===prior.rendered?prior.template:node.data;
      token.lastIndex=0;
      if(!token.test(original)){templates.delete(node);continue;}
      token.lastIndex=0;
      var rendered=original.replace(token,function(){return name;});
      templates.set(node,{template:original,rendered:rendered});
      if(node.data!==rendered)node.data=rendered;
    }
  }
  function schedule(){if(!queued){queued=true;queueMicrotask(sync);}}
  function start(){
    if(!document.body)return;
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
    sync();
  }
  window.addEventListener('host-ready',schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>`;

export function mufyPlayerNameBinding(srcdoc: string): string {
  return /\bmufyer\b|\{\{\s*user\s*\}\}/i.test(srcdoc) &&
    !srcdoc.includes('data-nj-mufy-player-binding') ? MUFY_PLAYER_NAME_BINDING : '';
}

interface PlayerNameTextNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: PlayerNameTextNode[];
}

const literalTextTags = new Set([
  "script", "style", "textarea", "template", "code", "pre", "kbd", "samp",
]);

/** Apply the same display-name binding to the opening rendered outside an iframe. */
export function rehypeBindMufyOpeningPlayerName(playerName: string | undefined) {
  return () => (tree: PlayerNameTextNode) => {
    if (!playerName?.trim()) return;
    const name = playerName;

    function bind(node: PlayerNameTextNode): void {
      const props = node.properties;
      const rel = props?.rel;
      if (
        literalTextTags.has(node.tagName ?? "") ||
        props?.dataMufySourceCredit !== undefined ||
        props?.contentEditable === "true" ||
        (node.tagName === "a" && (rel === "author" || (Array.isArray(rel) && rel.includes("author"))))
      ) return;

      if (node.type === "text" && typeof node.value === "string") {
        node.value = node.value.replace(/\bmufyer\b|\{\{\s*user\s*\}\}/gi, () => name);
      }
      for (const child of node.children ?? []) bind(child);
    }
    bind(tree);
  };
}
