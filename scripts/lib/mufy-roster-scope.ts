/** Metadata reconciliation only; never reads or transforms held character content. */
export function isMufyBatch30Rank(rank:number):boolean{return Number.isInteger(rank)&&rank>=21&&rank<=50;}
export function withImportedScopeHold<T extends {rank:number;name:string;sourceKey:string}>(row:T,hold:{rank:number;reason:string;fullFidelityAccepted:boolean},evidence:string){
 if(row.rank!==hold.rank||!isMufyBatch30Rank(row.rank)||!hold.reason.trim()||hold.fullFidelityAccepted!==false||!evidence.startsWith('next-batch-30-20261028/final-acceptance/')||evidence.includes('..'))throw Error('VERIFIED_IMPORTED_SCOPE_HOLD_REQUIRED');
 return {...row,imported:true,migrationStatus:'已迁移范围暂缓',contentScopeStatus:'held',processingStage:'assistant-content-scope-hold-imported',scopeEvidence:evidence,reason:hold.reason,accepted:false,fullFidelityAccepted:false,acceptanceStatus:'已导入但范围暂缓；不继续增强或验收，不算通过',acceptanceNote:'Imported scope hold; existing target preserved, not deleted or reworked'};
}
