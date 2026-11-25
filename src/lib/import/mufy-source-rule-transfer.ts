import { buildMufySourceRuleEnvelope, prepareMufySourceRules, type MufySourceRuleCapture } from './mufy-source-rules';
import type { ExternalCardRule } from './external-card';
import {publicCssColor} from './mufy-public-semantic-skin';

// Mufy's host preflight applied border-box to native details controls. Native
// status HTML in an opaque source canvas otherwise falls back to content-box.
// Zero specificity keeps every explicit author box-sizing declaration in charge.
export const MUFY_SOURCE_CANVAS_BASELINE='\n:where(.mufy-source-canvas summary){box-sizing:border-box}\n'+
  // Observed source host preflight: img,video {max-width:100%;height:auto}.
  // Do not invent sticker sizes; explicit source component CSS still wins.
  ':where(.mufy-source-canvas img,.mufy-source-canvas video){max-width:100%;height:auto}\n'+
  // Public source CSSOM also declares universal border-box. Recreate only that
  // neutral sizing contract, at zero specificity, not source-wide theme colors.
  ':where(.mufy-source-canvas,.mufy-source-canvas *,.mufy-source-canvas *::before,.mufy-source-canvas *::after){box-sizing:border-box}\n';

/** Same public-avatar opt-in as the host compatibility rule, inside a source canvas.
 * Keep the model protocol untouched so the author's ordered regex chain sees it.
 */
export function mufySourceSpeechSkin(avatarUrl?: string | null): string {
  if(!avatarUrl)return '';
  const url=new URL(avatarUrl);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('INVALID_PUBLIC_SPEECH_AVATAR');
  return `\n/* Explicit migration compatibility: public source speech avatar. */
.mufy-source-canvas :is(message,mes){display:block;position:relative;box-sizing:border-box;min-height:36px;margin:8px 0;padding-left:52px}
.mufy-source-canvas :is(message,mes)::before{content:"";position:absolute;left:0;top:0;width:36px;height:36px;border-radius:50%;background-image:url(${JSON.stringify(url.href)});background-size:cover;background-position:center}\n`;
}

/** A public DOM snapshot is not a substitute for the ordered reply renderer. */
export function sourceRuleTransfer(capture: unknown, roleId: string, skinCss = '', publicSpeechAvatar?: string | null, publicNativeTextColor?:string): {
  capture: MufySourceRuleCapture;
  rules: ExternalCardRule[];
  ruleCount: number;
  envelope: ReturnType<typeof buildMufySourceRuleEnvelope>;
} {
  const prepared = prepareMufySourceRules(capture, roleId);
  const checked=capture as MufySourceRuleCapture;
  const keys=['version','roleId','capturedAt','captureScope','responseCode','responseDataWasNull','rules'];
  const ruleKeys=['regexRuleId','ruleName','regPattern','replaceString','targetSymbol','mode','enabled','visibility','userEnabled'];
  if(Object.keys(checked).some(k=>!keys.includes(k))||checked.rules.some(r=>Object.keys(r).some(k=>!ruleKeys.includes(k))))throw Error('UNEXPECTED_RENDER_CAPTURE_FIELD');
  const nativeSkin=publicNativeTextColor?`\n.mufy-source-canvas{color:${publicCssColor(publicNativeTextColor)}}\n`:'';
  // Preflight precedes authored CSS so even an explicit universal author reset
  // wins equal-specificity declarations. Never append defaults over the author.
  const envelope = buildMufySourceRuleEnvelope(capture, roleId, MUFY_SOURCE_CANVAS_BASELINE+skinCss+mufySourceSpeechSkin(publicSpeechAvatar)+nativeSkin);
  return {
    capture: capture as MufySourceRuleCapture,
    ruleCount: prepared.length,
    envelope,
    rules: envelope ? [{
      ruleName: envelope.name,
      regexPattern: envelope.pattern,
      replaceString: envelope.replacement,
      enabled: true,
      visibility: false,
    }] : [],
  };
}
