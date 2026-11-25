import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
type Rule={regexPattern:string;replaceString:string};
const rules=JSON.parse(readFileSync(root+'/cuizhiyu-source-presentation-rules.json','utf8')) as Rule[];
const avatars=JSON.parse(readFileSync(root+'/cuizhiyu-speech-avatar-compatibility.json','utf8')) as Rule[];
function apply(raw:string,items:Rule[]){return items.reduce((s,r)=>{const p=r.regexPattern.lastIndexOf('/');return s.replace(new RegExp(r.regexPattern.slice(1,p),r.regexPattern.slice(p+1)),r.replaceString)},raw)}
test('source ornament applies only to populated scenes, not opening placeholders',()=>{
 expect(apply('<div class="Z_CONFIG_compact_wrap">真实地点</div>',rules)).toContain('mufy-source-think-indicator');
 expect(apply('<div class="Z_CONFIG_compact_wrap">ai生成地点</div>',rules)).not.toContain('mufy-source-think-indicator');
 expect(apply('其他角色的回复',rules)).toBe('其他角色的回复');
});
test('only the independent raw completion suffix is hidden; story stars survive',()=>{
 expect(apply('故事☆仍保留\n☆已生成完整',rules)).toBe('故事☆仍保留\n<!-- completion checked in raw reply -->');
 expect(apply('他写下☆已生成完整几个字。',rules)).toBe('他写下☆已生成完整几个字。');
});
test('speech avatars are one per message, not added to narration or status panels',()=>{
 const result=apply('<p>旁白</p><message>你好</message><mes>再见</mes><details>状态</details>',avatars);
 expect((result.match(/<img /g)||[]).length).toBe(2);
 expect(result).toContain('<p>旁白</p>');
 expect(result).toContain('<details>状态</details>');
 expect(apply(result,avatars)).toBe(result);
});
