import {expect,test} from 'bun:test';
import {buildMufyPublicSemanticSkin,buildMufyPublicControlSurface,lowerLegacyMufyModelSnapshot,type MufyPublicSemanticAppearance} from '../mufy-public-semantic-skin';
const facts:MufyPublicSemanticAppearance={version:1,roleId:'role',sourceUrl:'https://chat.mufy.ai/chat?roleId=role',observedAt:new Date().toISOString(),captureScope:'normal-page-public-native-semantic-styles',titleColor:'rgb(180, 50, 50)',narrationColor:'rgb(255, 255, 255)',extraControlColor:'rgb(180, 50, 50)',model:{color:'rgb(228, 228, 231)',backgroundColor:'rgba(0, 0, 0, 0)',backgroundImage:'linear-gradient(135deg, rgb(180, 50, 50) 0%, rgb(139, 32, 32) 100%)'},composer:{color:'rgb(0, 0, 0)',placeholderColor:'rgba(0, 0, 0, 0.35)'}};
test('control-only evidence updates all four native surfaces without inventing prose or geometry',()=>{
 const control={version:1 as const,roleId:facts.roleId,sourceUrl:facts.sourceUrl,observedAt:facts.observedAt,captureScope:'normal-page-public-native-control-styles' as const,model:{...facts.model,borderColor:'rgb(218, 0, 55)'}};
 const css=buildMufyPublicControlSurface(control,'role');
 for(const id of ['nj_chat_input_replay_btn','nj_mask_btn','nj_chat_input_model_btn','nj_currency_switcher'])expect(css).toContain(('#'+id).repeat(11));
 expect(css).toContain('--mufy-control-border:rgb(218, 0, 55)');
 expect(css).not.toMatch(/nj_chat_header|narration|box-shadow:|content:|position:|width:/);
 expect(()=>buildMufyPublicControlSurface(control,'other')).toThrow();
 expect(()=>buildMufyPublicControlSurface({...control,model:{...control.model,backgroundImage:'url(https://evil.test)'}},'role')).toThrow();
});
test('uses source appearance without replacing real model labels or layout',()=>{
 const skin=buildMufyPublicSemanticSkin(facts,'role');
 expect(skin.nativeTextColor).toBe(facts.narrationColor);
 expect(skin.hostCss).toContain(facts.model.backgroundImage);
 expect(skin.hostCss).toContain('#nj_chat_header h1');
 expect(skin.hostCss).toContain('#nj_chat_input_container '+('#nj_chat_input_model_btn').repeat(8));
 expect(skin.hostCss).not.toMatch(/content:|position:|REPLAY|MUMU/);
});

test('legacy computed model snapshot cannot outrank the replay family; other bytes stay intact',()=>{
 const ink=(ids:string[])=>ids.map(id=>'#nj_chat_input_container '+('#'+id).repeat(11)).join(',')+'{';
 const old=buildMufyPublicSemanticSkin(facts,'role').hostCss.replace('#nj_chat_input_container '+('#nj_chat_input_model_btn').repeat(8)+'{','#nj_chat_input_container '+('#nj_chat_input_model_btn').repeat(11)+'{').replace(ink(['nj_chat_input_replay_btn','nj_mask_btn','nj_chat_input_model_btn','nj_currency_switcher']),ink(['nj_chat_input_replay_btn','nj_mask_btn','nj_currency_switcher']));
 const repaired=lowerLegacyMufyModelSnapshot(old,'role');
 expect(repaired).toBe(buildMufyPublicSemanticSkin(facts,'role').hostCss);
 expect(()=>lowerLegacyMufyModelSnapshot(old,'other')).toThrow();
 expect(()=>lowerLegacyMufyModelSnapshot(old+old,'role')).toThrow();
 expect(()=>lowerLegacyMufyModelSnapshot(repaired,'role')).toThrow();
 expect(lowerLegacyMufyModelSnapshot(old.replace('#nj_chat_input_container '+('#nj_chat_input_model_btn').repeat(11)+'{','#nj_chat_input_container '+('#nj_chat_input_model_btn').repeat(8)+'{'),'role')).toBe(repaired);
});
test('rejects wrong source binding, arbitrary CSS and URL-backed images',()=>{
 expect(()=>buildMufyPublicSemanticSkin(facts,'other')).toThrow();
 expect(()=>buildMufyPublicSemanticSkin({...facts,titleColor:'red;display:none'},'role')).toThrow();
 expect(()=>buildMufyPublicSemanticSkin({...facts,model:{...facts.model,backgroundImage:'url(https://example.test/private)'}},'role')).toThrow();
});
test('host-only controls can explicitly share observed source model surface without copying labels',()=>{
 const css=buildMufyPublicSemanticSkin({...facts,extraControlSurface:'source-model-fallback',model:{...facts.model,borderColor:'rgba(220, 190, 120, 0.45)'}},'role').hostCss;
 expect(css).toContain('#nj_currency_switcher');
 expect(css.match(/background-image:linear-gradient/g)?.length).toBe(2);
 expect(css).toContain('border-color:rgba(220, 190, 120, 0.45)!important');
 expect(css).not.toMatch(/content:|width:|position:/);
});
