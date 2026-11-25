/** Appearance facts from visible source DOM, never private class/state payloads. */
export interface MufyPublicSemanticAppearance {
  version: 1;
  roleId: string;
  sourceUrl: string;
  observedAt: string;
  captureScope: 'normal-page-public-native-semantic-styles';
  titleColor: string;
  narrationColor: string;
  extraControlColor: string;
  model: {color:string; backgroundColor:string; backgroundImage:string; borderColor?:string};
  composer: {color:string; placeholderColor:string};
  /** Host-only controls: user-requested palette fallback, not source UI identity. */
  extraControlSurface?: 'source-model-fallback';
}
export function publicCssColor(value:string):string {
  if(typeof value!=='string'||value.length>80||!/^rgba?\([0-9.,%\s]+\)$/.test(value))throw Error('INVALID_PUBLIC_CSS_COLOR');
  return value;
}

/** A control-only capture must not invent unseen narration/title appearance. */
export interface MufyPublicControlAppearance {
  version:1;
  roleId:string;
  sourceUrl:string;
  observedAt:string;
  captureScope:'normal-page-public-native-control-styles';
  model:MufyPublicSemanticAppearance['model'];
}
export function buildMufyPublicControlSurface(value:MufyPublicControlAppearance,roleId:string):string {
  const url=new URL(value.sourceUrl);
  if(value.version!==1||value.roleId!==roleId||url.origin!=='https://chat.mufy.ai'||url.pathname!=='/chat'||url.searchParams.get('roleId')!==roleId||value.captureScope!=='normal-page-public-native-control-styles'||!Number.isFinite(Date.parse(value.observedAt)))throw Error('PUBLIC_CONTROL_SOURCE_MISMATCH');
  const bg=publicCssColor(value.model.backgroundColor),ink=publicCssColor(value.model.color),border=publicCssColor(value.model.borderColor??value.model.color);
  const image=value.model.backgroundImage;
  if(image!=='none'&&!/^linear-gradient\([a-z0-9.,()%\s-]+\)$/i.test(image))throw Error('UNSUPPORTED_PUBLIC_MODEL_BACKGROUND');
  const selectors=['nj_chat_input_replay_btn','nj_mask_btn','nj_chat_input_model_btn','nj_currency_switcher'].map(id=>`#nj_chat_input_container ${('#'+id).repeat(11)}`).join(',');
  return `\n/* Observed native control surface; source role ${roleId}. No labels, geometry or glow overwritten. */\n${selectors}{--mufy-control-bg:${bg};--mufy-control-ink:${ink};--mufy-control-border:${border};background-color:var(--mufy-control-bg)!important;background-image:${image}!important;color:var(--mufy-control-ink)!important;border-color:var(--mufy-control-border)!important}\n`;
}
export function buildMufyPublicSemanticSkin(value:MufyPublicSemanticAppearance,roleId:string){
  const url=new URL(value.sourceUrl);
  if(value.version!==1||value.roleId!==roleId||url.origin!=='https://chat.mufy.ai'||url.pathname!=='/chat'||url.searchParams.get('roleId')!==roleId||value.captureScope!=='normal-page-public-native-semantic-styles'||!Number.isFinite(Date.parse(value.observedAt)))throw Error('PUBLIC_SEMANTIC_SOURCE_MISMATCH');
  const title=publicCssColor(value.titleColor),text=publicCssColor(value.narrationColor),extra=publicCssColor(value.extraControlColor);
  const modelColor=publicCssColor(value.model.color),modelBg=publicCssColor(value.model.backgroundColor);
  const image=value.model.backgroundImage;
  if(image!=='none'&&!/^linear-gradient\([a-z0-9.,()%\s-]+\)$/i.test(image))throw Error('UNSUPPORTED_PUBLIC_MODEL_BACKGROUND');
  const composer=publicCssColor(value.composer.color),placeholder=publicCssColor(value.composer.placeholderColor);
  const border=value.model.borderColor?publicCssColor(value.model.borderColor):undefined;
  if(value.extraControlSurface&&value.extraControlSurface!=='source-model-fallback')throw Error('UNSUPPORTED_EXTRA_CONTROL_SURFACE');
  // Keep real model names, icons, layout and behavior. These are appearance-only
  // semantic aliases for differing source/host DOM, not copied literal labels.
  // A computed model snapshot is a fallback, not an explicit author replay
  // family donor. Keep it below the ten-ID family adapter, or an old snapshot
  // can override the user's requested model/replay palette synchronization.
  // Only an explicitly chosen all-control source fallback keeps eleven IDs.
  const appearanceSelector=(id:string)=>`#nj_chat_input_container ${('#'+id).repeat(11)}`;
  const model=value.extraControlSurface?appearanceSelector('nj_chat_input_model_btn'):`#nj_chat_input_container ${'#nj_chat_input_model_btn'.repeat(8)}`;
  // The replay-family ink must also outrank functional text restoration on the
  // model, without promoting the old model-only background snapshot again.
  const extras=(value.extraControlSurface?['nj_chat_input_replay_btn','nj_mask_btn','nj_currency_switcher']:['nj_chat_input_replay_btn','nj_mask_btn','nj_chat_input_model_btn','nj_currency_switcher']).map(appearanceSelector).join(',');
  return {nativeTextColor:text,hostCss:`\n/* Public DOM appearance compatibility; source role ${roleId}. */
#nj_chat_header h1{color:${title}!important}
${model}{background-color:${modelBg}!important;background-image:${image}!important;color:${modelColor}!important;${border?`border-color:${border}!important`:''}}
${extras}{color:${value.extraControlSurface?modelColor:extra}!important;${value.extraControlSurface?`background-color:${modelBg}!important;background-image:${image}!important;${border?`border-color:${border}!important`:''}`:''}}
#nj_chat_input_box textarea{color:${composer}!important}
#nj_chat_input_box textarea::placeholder{color:${placeholder}!important}\n`};
}

/** Exact generated legacy selector only. Never rewrite arbitrary author CSS. */
export function lowerLegacyMufyModelSnapshot(css:string,roleId:string):string {
  if(!/^[a-z0-9-]+$/i.test(roleId)||!css.includes(`/* Public DOM appearance compatibility; source role ${roleId}. */`))throw Error('KNOWN_PUBLIC_APPEARANCE_MARKER_REQUIRED');
  const old=`#nj_chat_input_container ${'#nj_chat_input_model_btn'.repeat(11)}{`,next=`#nj_chat_input_container ${'#nj_chat_input_model_btn'.repeat(8)}{`;
  const selector=(id:string)=>`#nj_chat_input_container ${('#'+id).repeat(11)}`;
  const oldInk=['nj_chat_input_replay_btn','nj_mask_btn','nj_currency_switcher'].map(selector).join(',')+'{';
  const newInk=['nj_chat_input_replay_btn','nj_mask_btn','nj_chat_input_model_btn','nj_currency_switcher'].map(selector).join(',')+'{';
  if(css.split(oldInk).length!==2)throw Error('EXACT_SINGLE_LEGACY_FAMILY_INK_REQUIRED');
  const oldCount=css.split(old).length-1,nextCount=css.split(next).length-1;
  if(!((oldCount===1&&nextCount===0)||(oldCount===0&&nextCount===1)))throw Error('EXACT_SINGLE_LEGACY_MODEL_SNAPSHOT_REQUIRED');
  return css.replace(old,next).replace(oldInk,newInk);
}
