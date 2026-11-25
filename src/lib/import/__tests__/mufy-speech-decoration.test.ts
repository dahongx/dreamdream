import {expect,test} from 'bun:test';
import {adaptMufySpeechDecorationCss} from '../mufy-speech-decoration';
import {sanitizeAndScopeCss} from '../../styling/whitelist';
test('reserves a source bubble right decoration without changing its color, image or program',()=>{
 const source='.nj_ai_message_bubble::before{content:"";position:absolute;right:-20px;top:-20px;width:35px;background:url(https://example.test/icon.png)}';
 const result=adaptMufySpeechDecorationCss(source);
 expect(result.paddingRightPx).toBe(20);expect(result.matchedRules).toBe(1);expect(result.css.startsWith(source)).toBe(true);expect(result.css).toContain('padding-right:20px');expect(result.css).not.toContain('overflow:hidden');
 expect(sanitizeAndScopeCss(result.css,'card').css).toContain('[data-character-css="card"] #nj_chat_messages .mufy-import-speech-row');
 expect(sanitizeAndScopeCss(result.css,'card').css).toContain('padding-right: 20px');
});
test('supports observed legacy escaped selectors, after decoration and responsive upper bound',()=>{
 const source='.mufy\\_ai_message_bubble::after{position:absolute;right:-8.2px}@media(max-width:480px){.nj_ai_message_bubble::before{position:absolute;right:-20px}}';
 expect(adaptMufySpeechDecorationCss(source).paddingRightPx).toBe(20);
});
test('does not touch ordinary cards, unrelated pseudos, positive insets or in-flow elements',()=>{
 for(const source of ['', '.other::before{position:absolute;right:-50px}', '.nj_ai_message_bubble::before{position:absolute;right:4px}', '.nj_ai_message_bubble::before{right:-20px}'])expect(adaptMufySpeechDecorationCss(source)).toEqual({css:source,paddingRightPx:0,matchedRules:0,changed:false});
});
test('known guard is idempotent and cannot repeatedly narrow a card',()=>{
 const first=adaptMufySpeechDecorationCss('.nj_ai_message_bubble::before{position:absolute;right:-20px}');
 const again=adaptMufySpeechDecorationCss(first.css);expect(again.css).toBe(first.css);expect(again.changed).toBe(false);
 const updated=adaptMufySpeechDecorationCss(first.css.replace('right:-20px','right:-30px'));expect(updated.css).toContain('padding-right:30px');expect(updated.css.match(/MUFY_SPEECH_DECORATION_SPACE/g)?.length).toBe(1);
 const removed=adaptMufySpeechDecorationCss(first.css.replace('right:-20px','right:0px'));expect(removed.css).not.toContain('MUFY_SPEECH_DECORATION_SPACE');
});
test('unknown or oversized negative geometry requires review instead of invented dimensions',()=>{
 for(const right of ['-2em','calc(-1 * var(--outset))','var(--right)','-129px'])expect(()=>adaptMufySpeechDecorationCss(`.nj_ai_message_bubble::before{position:absolute;right:${right}}`)).toThrow();
});
