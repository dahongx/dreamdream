// Authorized cua_repl only: rendered public DOM, normal folds, versioned files.
import {mkdir,readFile,writeFile,appendFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectMufySurfaceStep} from './mufy-browser-state-driver.js';
import {captureMufyViewportProof} from './mufy-browser-viewport-proof.js';
import {openingSettledProof} from './mufy-opening-settled-proof.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function openingReleaseCheckpoint({tab,browser,expected,root,nativePngEncoder,recapture=false,capture=captureMufyViewportProof,measure=openingSettledProof,driver=inspectMufySurfaceStep}){
 if(!/^[a-z0-9-]+$/.test(expected.key)||!expected.rendererSha256)throw Error('VERSIONED_TARGET_REQUIRED');
 await mkdir(root,{recursive:true});const stem=`${expected.key}-${expected.surface}-${expected.width}-${expected.state}`;
 try{const old=JSON.parse(await readFile(join(root,stem+'.json'),'utf8'));if(JSON.stringify(old.expected)!==JSON.stringify(expected)||sha(await readFile(join(root,old.screenshot.path)))!==old.screenshot.sha256)throw Error('CHECKPOINT_BINDING_MISMATCH');if(old.openingMeasurement?.settle&&!recapture)return{stem,reused:true};const archive=join(root,'non-accepting',String(Date.now()));await mkdir(archive,{recursive:true});for(const ext of ['.json','.png','.original.jpg'])await rename(join(root,stem+ext),join(archive,stem+ext));}catch(e){if(e.code!=='ENOENT')throw e;}
 const startedAt=new Date().toISOString(),start=performance.now();
 try{
 let measured;
 const r=await driver(tab,expected,{browser,height:600,viewportMode:'browser',nativePngEncoder,deferOpeningFrameMetrics:true,captureViewportProof:async(t,e,o)=>{const p=await measure(t,e,o,(t,e,o)=>capture(t,e,{...o,nativeViewportCapture:true}));measured=p.openingMeasurement;return p;}});
 r.openingMeasurement=measured;
 if(r.frames.length===0)r.frames=measured.frames;
 const {pngBytes,originalBytes,...meta}=r;
 if(originalBytes){await writeFile(join(root,stem+'.original.jpg'),originalBytes);meta.capture={...meta.capture,original:{path:stem+'.original.jpg',sha256:sha(originalBytes)}};}
 await writeFile(join(root,stem+'.png'),pngBytes);await writeFile(join(root,stem+'.json'),JSON.stringify({...meta,screenshot:{path:stem+'.png',sha256:sha(pngBytes)}},null,2));
 const elapsedMs=performance.now()-start-(r.checkpointPauseMs??0);await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({startedAt,observedAt:r.observedAt,elapsedMs,checkpointPauseMs:r.checkpointPauseMs??0,stem,status:'ok'})+'\n');return{stem,elapsedMs,settled:r.openingMeasurement.settle.ok};
 }catch(e){await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-start,stem,status:'failed',error:e.message})+'\n');throw e;}
}
