/** Offline import helper. Reserve measured author decoration space, not a theme. */
import postcss from 'postcss';

const marker='/* MUFY_SPEECH_DECORATION_SPACE */';
export function adaptMufySpeechDecorationCss(input:string):{css:string;paddingRightPx:number;matchedRules:number;changed:boolean}{
 if(input.length>1_000_000)throw Error('SOURCE_SPEECH_CSS_TOO_LARGE');
 const owned=/\n?\/\* MUFY_SPEECH_DECORATION_SPACE \*\/\n#nj_chat_messages \.mufy-import-speech-row\{box-sizing:border-box;padding-right:\d+px\}/g;
 const clean=input.replace(owned,'');
 if(clean.includes(marker))throw Error('SOURCE_SPEECH_DECORATION_GUARD_CHANGED');
 const root=postcss.parse(clean);let paddingRightPx=0,matchedRules=0;
 root.walkRules(rule=>{
  if(!rule.selectors.some(selector=>/\.(?:nj|mufy)_ai_message_bubble::(?:before|after)$/.test(selector.trim().replace(/\\_/g,'_'))))return;
  let position='',right='';rule.walkDecls(d=>{if(d.prop.toLowerCase()==='position')position=d.value.trim().toLowerCase();if(d.prop.toLowerCase()==='right')right=d.value.trim().toLowerCase();});
  if(position!=='absolute'||!right)return;
  const negative=right.match(/^-(\d+(?:\.\d+)?)px$/);
  if(!negative){if(/^[-]|^calc\(|^var\(/.test(right))throw Error('SOURCE_SPEECH_DECORATION_REVIEW_REQUIRED');return;}
  const px=Math.ceil(Number(negative[1]));if(px>128)throw Error('SOURCE_SPEECH_DECORATION_TOO_WIDE');
  paddingRightPx=Math.max(paddingRightPx,px);matchedRules++;
 });
 const guard=`${marker}\n#nj_chat_messages .mufy-import-speech-row{box-sizing:border-box;padding-right:${paddingRightPx}px}`;
 const css=paddingRightPx===0?clean:clean+'\n'+guard;
 return {css,paddingRightPx,matchedRules,changed:css!==input};
}
