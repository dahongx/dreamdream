import { wrapBareSrcdoc } from "@/lib/regex/iframe-bridge";

/** Only the known public composer companion, never arbitrary model output. */
export function extractMufyComposerCompanion(content: string): string | null {
  const scripts = [
    ...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi),
  ]
    .map((match) => match[1])
    .filter(
      (script) =>
        !script.includes("__MUFY_ARTIFACT_BRIDGE__") &&
        [
          "censy-pet-companion-v1",
          "censy-pet-avatar",
          "censy-pet-bubble",
          "#mufy_chat_input_box",
          "p.censyPetSpeak",
          "const htmlStr =",
        ].every((marker) => script.includes(marker)) &&
        /const p = window\.parent;/.test(script),
    );
  return scripts.length === 1 ? scripts[0] : null;
}

export type CompanionIntent =
  | "empty"
  | "typing_long"
  | "typing_love"
  | "typing_question"
  | "typing_idle";
export type CompanionAction =
  | "message"
  | "follow"
  | "replay"
  | "model"
  | "delete"
  | "copy"
  | "menu"
  | "save"
  | "slider";
export function companionControlAction(
  target: Element,
): CompanionAction | null {
  const controls: ReadonlyArray<readonly [string, CompanionAction]> = [
    ["#nj_header_message_btn", "message"],
    ["#nj_header_follow_btn", "follow"],
    ["#nj_chat_input_replay_btn", "replay"],
    ["#nj_chat_input_model_btn,.nj_chat_input_model_btn", "model"],
    ["#nj_message_actions_delete", "delete"],
    ["#nj_message_actions_copy", "copy"],
    ["#nj_message_actions_btn,#nj_message_actions_box", "menu"],
    ['div[role="dialog"][data-state="open"]', "save"],
  ];
  return controls.find(([selector]) => target.closest(selector))?.[1] ?? null;
}
/** The author's sandbox receives only this enum, never a draft or history. */
export function companionDraftIntent(draft: string): CompanionIntent {
  const value = draft.trim();
  if (!value) return "empty";
  if (value.length > 25) return "typing_long";
  if (/喜欢|爱|想/.test(value)) return "typing_love";
  if (/[?？吗]/.test(value)) return "typing_question";
  return "typing_idle";
}

export interface CompanionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function validateCompanionBounds(
  value: unknown,
): CompanionBounds | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.type !== "mufy-composer-companion-bounds") return null;
  const keys = ["x", "y", "width", "height"] as const;
  if (
    keys.some(
      (key) =>
        typeof data[key] !== "number" ||
        !Number.isFinite(data[key]) ||
        (data[key] as number) < 0,
    )
  )
    return null;
  const b = data as unknown as CompanionBounds;
  if (
    b.width <= 0 ||
    b.height <= 0 ||
    b.x + b.width > 320 ||
    b.y + b.height > 240
  )
    return null;
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

/** An opaque, local virtual composer. No host RPC, context, or real parent DOM. */
export function buildMufyComposerCompanionFrame(program: string): string {
  const isolated = program.replace(
    "const p = window.parent;",
    "const p = window;",
  );
  if (isolated === program) throw Error("COMPANION_PARENT_ALIAS_MISSING");
  return wrapBareSrcdoc(`<style>
html,body{width:320px!important;height:240px!important;overflow:hidden!important;margin:0!important;padding:0!important;background:transparent!important}
#mufy_chat_input_box{position:absolute;bottom:0;right:-15px;width:320px;height:0}
#mufy_chat_input_box>textarea{display:none}
</style><div id="mufy_chat_input_box"><textarea aria-hidden="true" tabindex="-1"></textarea></div><div id="nj_companion_virtual_slider" class="absolute h-full bg-primary" hidden></div><script>${isolated}</script>
<script data-mufy-composer-companion-adapter>(function(){
 var last='',queued=false;
 function measure(){queued=false;var rects=[];
 ['censy-pet-avatar','censy-pet-bubble'].forEach(function(id){var node=document.getElementById(id);if(!node)return;var style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return;var r=node.getBoundingClientRect();if(r.width&&r.height)rects.push(r);});
 if(!rects.length)return;
 var x=Math.max(0,Math.floor(Math.min.apply(null,rects.map(function(r){return r.left;})))-4),y=Math.max(0,Math.floor(Math.min.apply(null,rects.map(function(r){return r.top;})))-4);
 var right=Math.min(320,Math.ceil(Math.max.apply(null,rects.map(function(r){return r.right;})))+4),bottom=Math.min(240,Math.ceil(Math.max.apply(null,rects.map(function(r){return r.bottom;})))+4);
 var value={type:'mufy-composer-companion-bounds',x:x,y:y,width:right-x,height:bottom-y},key=JSON.stringify(value);if(key!==last){last=key;parent.postMessage(value,'*');}}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}
 window.addEventListener('message',function(event){if(event.source!==parent||!event.data)return;
 if(event.data.type==='mufy-composer-companion-action'){
 var action=event.data.action;
 if(action==='slider'){var slider=document.getElementById('nj_companion_virtual_slider');slider.style.width=slider.style.width==='1px'?'2px':'1px';return;}
 var buttons={message:'mufy_header_message_btn',follow:'mufy_header_follow_btn',replay:'mufy_chat_input_replay_btn',model:'',delete:'',copy:'',menu:'mufy_message_actions_box',save:''};
 if(!Object.prototype.hasOwnProperty.call(buttons,action))return;
 var button=document.createElement(action==='save'?'div':'button');button.hidden=true;button.id=buttons[action];
 if(action==='save'){button.setAttribute('role','dialog');button.setAttribute('data-state','open');}
 if(action==='model')button.className='mufy_chat_input_model_btn';
 if(action==='delete')button.className='text-red-500';
 if(action==='copy')button.innerHTML='<svg class="lucide-copy"></svg>';
 document.body.appendChild(button);(action==='copy'?button.firstElementChild:button).dispatchEvent(new MouseEvent('click',{bubbles:true}));button.remove();return;}
 if(event.data.type!=='mufy-composer-companion-intent')return;
 var examples={empty:'',typing_long:'abcdefghijklmnopqrstuvwxyz',typing_love:'喜欢',typing_question:'？',typing_idle:'继续'};
 var kind=event.data.intent;if(!Object.prototype.hasOwnProperty.call(examples,kind))return;
 var input=document.querySelector('#mufy_chat_input_box textarea');input.value=examples[kind];input.dispatchEvent(new Event('input',{bubbles:true}));});
 function start(){new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});new ResizeObserver(schedule).observe(document.body);measure();}
 // A zero-area bootstrap frame can suspend rAF. An image becoming ready must
 // report synchronously or the avatar never makes the host visible.
 window.addEventListener('load',function(){last='';measure();},true);
 document.addEventListener('load',function(){last='';measure();},true);
 ['transitionend','animationend'].forEach(function(name){window.addEventListener(name,schedule,true);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();</script>`);
}
