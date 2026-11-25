import {expect,test} from 'bun:test';
import {appendComposerDraft} from '../opening/composer-fill';
test('ordinary host fills preserve the existing newline contract',()=>{
 expect(appendComposerDraft('','第一条')).toBe('第一条');
 expect(appendComposerDraft('原草稿','下一条')).toBe('原草稿\n下一条');
 expect(appendComposerDraft('原草稿\n','下一条')).toBe('原草稿\n下一条');
 expect(appendComposerDraft('原草稿','')).toBe('原草稿');
});
test('source inline append preserves exact chained content including explicit source whitespace',()=>{
 const first=appendComposerDraft('原草稿','第一条',{separator:'none'});
 expect(first).toBe('原草稿第一条');
 expect(appendComposerDraft(first,'第二条',{separator:'none'})).toBe('原草稿第一条第二条');
 expect(appendComposerDraft(first,'\n第三条',{separator:'none'})).toBe('原草稿第一条\n第三条');
});
