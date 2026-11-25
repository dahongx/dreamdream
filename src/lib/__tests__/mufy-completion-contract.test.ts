import {expect,test} from 'bun:test';
import {adaptMufyCompletionContract,reviewMufyCompletion} from '../import/mufy-completion-contract';
const panels='<div><details class="Cmtt_fold_block"><div class="Ks_split_layout">状态内容</div></details><details class="Cmtt_fold_block"><div class="Tuan_mobile_vertical">群聊论坛</div></details><details class="Cmtt_fold_block"><div class="Z_CONFIG_extra">番外内容</div></details></div>';
test('only explicitly required completion markers activate the idempotent adapter',()=>{
 expect(adaptMufyCompletionContract('普通卡')).toBe('普通卡');
 const before='原卡要求：末尾存在☆已生成完整\n'+panels;
 const adapted=adaptMufyCompletionContract(before);
 expect(adapted.startsWith(before)).toBe(true);
 expect(adaptMufyCompletionContract(adapted)).toBe(adapted);
 expect(adapted).toContain('DEARM_STATE_END注释之前');
 expect(adaptMufyCompletionContract('另一张卡仅要求☆已生成完整')).not.toContain('<MufyCompletionCompatibility>');
 expect(adaptMufyCompletionContract('三个状态栏；末尾☆已生成完整')).toContain('<MufyCompletionCompatibility>');
});
test('a star alone is not proof of complete UI; neither is transport completion',()=>{
 expect(reviewMufyCompletion('☆已生成完整').ok).toBe(false);
 expect(reviewMufyCompletion(panels).ok).toBe(false);
 expect(reviewMufyCompletion(panels+'\n☆已生成完整\n<!-- DEARM_STATE_END -->').ok).toBe(true);
 expect(reviewMufyCompletion(panels+'☆已生成完整\n新正文').ok).toBe(false);
 expect(reviewMufyCompletion(panels.replace('番外内容','ai填充')+'☆已生成完整').ok).toBe(false);
 expect(reviewMufyCompletion(panels.slice(0,-6)+'☆已生成完整').ok).toBe(false);
});
