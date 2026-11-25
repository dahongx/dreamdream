/** Only prepared Mufy message canvases opt in. A new executable program or
 * stylesheet still gets a normal sandbox document initialization. Text growth
 * alone must not navigate an iframe or restart its animations/scripts. */
export function iframeProgramKey(srcdoc:string):string {
  return [...srcdoc.matchAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi)].map(m=>m[0]).join('\n');
}

export function buildIframeIncrementalScript(seed:string):string {
  const encoded=JSON.stringify(seed).replace(/</g,'\\u003c');
  return `<script data-nj-incremental-bridge>(function(seed){
  var root,previous,mapping=new WeakMap(),pending,lastSequence=0;
  function parse(html){var t=document.createElement('template');t.innerHTML=html;return t.content.querySelector('.mufy-source-canvas');}
  function compatible(a,b){if(!a||!b||a.nodeType!==b.nodeType||a.nodeName!==b.nodeName)return false;if(a.nodeType===1&&(a.id||b.id))return a.id===b.id;return true;}
  function bind(source,live){
    mapping.set(source,live);var actual=Array.from(live.childNodes),cursor=0;
    Array.from(source.childNodes).forEach(function(child){for(var i=cursor;i<actual.length;i++){if(compatible(child,actual[i])){bind(child,actual[i]);cursor=i+1;break;}}});
  }
  function transfer(old,next){var live=mapping.get(old);if(live)mapping.set(next,live);Array.from(old.childNodes).forEach(function(n,i){transfer(n,next.childNodes[i]);});}
  function patch(live,old,next){
    mapping.set(next,live);
    // Compare source snapshots, not runtime DOM. Author listeners, generated
    // children, open folds, selections and host-resolved names remain intact.
    if(old.isEqualNode(next)){transfer(old,next);return;}
    if(next.nodeType===3||next.nodeType===8){if(live.nodeValue!==next.nodeValue)live.nodeValue=next.nodeValue;return;}
    if(next.nodeType!==1)return;
    Array.from(old.attributes).forEach(function(a){if(!next.hasAttribute(a.name))live.removeAttribute(a.name);});
    Array.from(next.attributes).forEach(function(a){if(old.getAttribute(a.name)!==a.value)live.setAttribute(a.name,a.value);});
    var oldChildren=Array.from(old.childNodes),used=new Set(),anchor=live.firstChild;
    Array.from(next.childNodes).forEach(function(child,index){
      var prior=oldChildren[index];
      if(used.has(prior)||!compatible(prior,child))prior=oldChildren.find(function(n){return !used.has(n)&&compatible(n,child)&&n.isEqualNode(child);});
      var actual=prior&&mapping.get(prior);
      if(actual&&actual.parentNode===live){used.add(prior);patch(actual,prior,child);anchor=actual.nextSibling;}
      else{actual=child.cloneNode(true);live.insertBefore(actual,anchor);bind(child,actual);anchor=actual.nextSibling;}
    });
    oldChildren.forEach(function(n){var actual=mapping.get(n);if(!used.has(n)&&actual&&actual.parentNode===live)actual.remove();});
  }
  function apply(update){
    if(!root||!previous){pending=update;return;}
    if(update.sequence<=lastSequence)return;
    var next=parse(update.html);if(!next)return;
    patch(root,previous,next);previous=next;lastSequence=update.sequence;
    root.setAttribute('data-nj-stream-sequence',String(lastSequence));
    parent.postMessage({type:'nj-mufy-stream-applied',sequence:lastSequence},'*');
  }
  window.addEventListener('message',function(event){
    var d=event.data;
    if(event.source!==parent||!d||d.type!=='nj-mufy-stream-update'||typeof d.html!=='string'||d.html.length>2097152||!Number.isSafeInteger(d.sequence)||d.sequence<1)return;
    apply(d);
  });
  function start(){root=document.querySelector('.mufy-source-canvas');previous=parse(seed);if(root&&previous)bind(previous,root);if(pending){var next=pending;pending=null;apply(next);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})(${encoded});</script>`;
}
