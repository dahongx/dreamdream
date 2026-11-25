import {expect,test} from 'bun:test';
import {auditCandidateHashChain} from '../mufy-candidate-baseline';
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
test('a candidate chain remains tied to the freshly observed owner through every stage',()=>{
 expect(auditCandidateHashChain(a,[{id:'prefix',baselineSha256:a,candidateSha256:b,actualCandidateSha256:b},{id:'player',baselineSha256:b,candidateSha256:c,actualCandidateSha256:c}])).toEqual({ok:true,issues:[],finalSha256:c});
});
test('later owner repairs cannot silently disappear through a stale candidate base',()=>{
 expect(auditCandidateHashChain(c,[{id:'prefix',baselineSha256:a,candidateSha256:b,actualCandidateSha256:b}]).issues).toContainEqual({id:'prefix',reason:'stale-or-disconnected-baseline'});
});
test('changed artifacts, disconnected stages and duplicate IDs fail independently',()=>{
 const result=auditCandidateHashChain(a,[{id:'same',baselineSha256:a,candidateSha256:b,actualCandidateSha256:c},{id:'same',baselineSha256:b,candidateSha256:a,actualCandidateSha256:a}]);
 expect(result.ok).toBe(false);expect(result.issues.map(i=>i.reason)).toEqual(['candidate-content-does-not-match-proof','missing-or-duplicate-stage-id','stale-or-disconnected-baseline']);
});
test('missing chains and malformed hashes never establish readiness',()=>{
 expect(auditCandidateHashChain(a,[]).ok).toBe(false);expect(auditCandidateHashChain('unknown',[{id:'x',baselineSha256:'unknown',candidateSha256:b,actualCandidateSha256:b}]).ok).toBe(false);
});
