/** Offline agent guard. A candidate must extend the freshly observed owner,
 * not an older import snapshot. This does not certify UI or media fidelity. */
export interface CandidateHashStage {id:string;baselineSha256:string;candidateSha256:string;actualCandidateSha256:string}
export function auditCandidateHashChain(currentSha256:string,stages:CandidateHashStage[]):{ok:boolean;issues:{id:string;reason:string}[];finalSha256:string}{
 const valid=(s:string)=>/^[a-f0-9]{64}$/.test(s),issues:{id:string;reason:string}[]=[];
 if(!valid(currentSha256))issues.push({id:'owner',reason:'invalid-current-owner-hash'});
 if(!stages.length||stages.length>30)issues.push({id:'chain',reason:'invalid-stage-count'});
 let expected=currentSha256;const ids=new Set<string>();
 for(const stage of stages){
  if(!stage.id||ids.has(stage.id))issues.push({id:stage.id,reason:'missing-or-duplicate-stage-id'});ids.add(stage.id);
  if(![stage.baselineSha256,stage.candidateSha256,stage.actualCandidateSha256].every(valid))issues.push({id:stage.id,reason:'invalid-stage-hash'});
  if(stage.baselineSha256!==expected)issues.push({id:stage.id,reason:'stale-or-disconnected-baseline'});
  if(stage.candidateSha256!==stage.actualCandidateSha256)issues.push({id:stage.id,reason:'candidate-content-does-not-match-proof'});
  expected=stage.actualCandidateSha256;
 }
 return{ok:issues.length===0,issues,finalSha256:expected};
}
