/** Compare pixels from actual browser screenshots; never synthesize a passing UI image. */
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {writeFile,appendFile} from 'node:fs/promises';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=root+'/final-acceptance/49';
const hashes:Record<string,string>={};
for(const name of ['base','stroke','undo','redo','erase','erase-undo','clear','clear-undo']){
 const pixels=await sharp(`${dir}/halo-drawing-${name}-v2.png`).extract({left:40,top:160,width:240,height:150}).raw().toBuffer();hashes[name]=createHash('sha256').update(pixels).digest('hex');
}
const checks={strokeAppears:hashes.stroke!==hashes.base,undoRestoresBlank:hashes.undo===hashes.base,redoRestoresExactStroke:hashes.redo===hashes.stroke,eraserChangesOnlyPart:hashes.erase!==hashes.stroke&&hashes.erase!==hashes.base,undoEraseRestoresExactStroke:hashes['erase-undo']===hashes.stroke,clearRestoresBlank:hashes.clear===hashes.base,undoClearRestoresExactStroke:hashes['clear-undo']===hashes.stroke};
const proof={observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,scope:'actual local Chrome screenshot crop of visible stroke only; not source/TEST full-card acceptance',viewport:{cssWidth:390,cssHeight:844},crop:{left:40,top:160,width:240,height:150},hashes,checks,canvasGetContextUnavailableInReadOnlyFacade:true,screenshotClipCommandTimedOutOnce:true,authorProgramExecuted:false,buildStarted:false,deployed:false,fullFidelityAccepted:false,agentNetMs:null};
await writeFile(dir+'/halo-drawing-pixel-check.json',JSON.stringify(proof,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({id:'halo-drawing-pixels-'+proof.observedAt,kind:'screenshot-pixel-analysis',...proof})+'\n');console.log(JSON.stringify(checks));if(Object.values(checks).some(v=>!v))process.exitCode=1;
