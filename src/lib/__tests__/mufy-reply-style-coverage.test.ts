import {expect,test} from 'bun:test';
import {missingMufyDisclosureStyles} from '../import/mufy-reply-style-coverage';
test('content and clickable folds are not proof that source skin was captured',()=>{
 const html='<details class="Cmtt_fold_block"><summary class="Cmtt_summary">状态</summary>内容</details>';
 expect(missingMufyDisclosureStyles([html],':root{--Cmtt_glass_gradient:red}')).toEqual(['Cmtt_fold_block','Cmtt_summary']);
 expect(missingMufyDisclosureStyles([html],'.Cmtt_fold_block{background:red}@media(max-width:480px){.Cmtt_summary{padding:10px}}')).toEqual([]);
 expect(missingMufyDisclosureStyles([html],'/* .Cmtt_fold_block .Cmtt_summary */')).toHaveLength(2);
});
test('inline or unclassed native disclosures need no invented skin',()=>{
 expect(missingMufyDisclosureStyles(['<details style="color:red"><summary>状态</summary></details>'],'')).toEqual([]);
});
test('recaptured public Cui style covers all three source disclosure contracts',async()=>{
 const css=await Bun.file('logs/mufy-profiles/full-20261013/next-batch-5-20261019/cuizhiyu-public-status-style-20261022.css').text();
 expect(missingMufyDisclosureStyles(['<details class="Cmtt_fold_block"><summary class="Cmtt_summary">状态</summary></details>'],css)).toEqual([]);
});
