/** Offline public UI program scan. No network, hidden state or author execution. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {buildMufyComposerCompanionFrame,extractMufyComposerCompanion} from '../src/lib/import/mufy-composer-companion';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const startedAt=new Date().toISOString(),tick=performance.now();
const receipts=JSON.parse(await readFile(`${root}/normal-ui-import-receipts.json`,'utf8')) as {rows:{rank:number;sourceKey:string}[]};
if(receipts.rows.length!==28||new Set(receipts.rows.map(row=>row.rank)).size!==28)throw Error('BATCH_BASE_MISMATCH');
const rows=[];
for(const row of receipts.rows){
 const prepared=JSON.parse(await readFile(`${root}/prepared/${row.sourceKey}/prepared.json`,'utf8')) as {targetName:string;beautification:{openingComponent:string}};
 const program=extractMufyComposerCompanion(prepared.beautification.openingComponent);
 if(!program){rows.push({rank:row.rank,name:prepared.targetName,eligible:false});continue;}
 const frame=buildMufyComposerCompanionFrame(program),dom=new JSDOM(frame);
 // Compile syntax only; never run the captured program in this process.
 for(const script of dom.window.document.querySelectorAll('script'))new Function(script.textContent??'');
 if(!frame.includes("connect-src 'none'")||!frame.includes("frame-src 'none'")||frame.includes('const p = window.parent;'))throw Error('ISOLATION_REGRESSION');
 rows.push({rank:row.rank,name:prepared.targetName,eligible:true,programChars:program.length,programSha256:createHash('sha256').update(program).digest('hex'),scriptSyntaxPassed:true,originalProgramPreservedExceptLocalParentAlias:true,publicSourceOnly:true,fullFidelityAccepted:false});
 dom.window.close();
}
const result={startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,timingKind:'offline-scan-process-wall-not-agent-net',agentNetMs:null,rows,deployed:false,fullFidelityAccepted:false};
await writeFile(`${root}/composer-companion-candidate-audit.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({scanned:rows.length,eligible:rows.filter(row=>row.eligible).map(row=>row.rank),syntaxPassed:true,deployed:false}));
