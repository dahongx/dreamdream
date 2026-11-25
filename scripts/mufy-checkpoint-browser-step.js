/** Run only from authorized cua_repl. Public DOM + normal UI; no networking,
 * credentials, browser storage, application internals or database access.
 * One state per call: completed steps survive REPL resets and are not replayed.
 */
import { access, appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { inspectMufySurfaceStep } from "./mufy-browser-state-driver.js";

export async function checkpointMufyBrowserStep({tab,browser,expected,key,root,runId,deviceScaleFactor=undefined,nativePngEncoder=undefined,replace=false}) {
  if (!/^[a-z0-9-]+$/u.test(key) || !runId) throw Error("CHECKPOINT_KEY_REQUIRED");
  await mkdir(root,{recursive:true});
  const stem=`${key}-${expected.surface}-${expected.width}-${expected.state}`;
  const jsonPath=join(root,stem+".json"), pngPath=join(root,stem+".png");
  const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
  try {
    await access(jsonPath);
    const prior=JSON.parse(await readFile(jsonPath,"utf8"));
    if(!replace) {
      if(["characterId","characterName","surface","width","state","messageIndex"].some(k=>prior.expected?.[k]!==expected[k]) || prior.screenshot?.sha256!==hash(await readFile(pngPath))) throw Error("CHECKPOINT_BINDING_OR_HASH_MISMATCH");
      return {key:stem,reused:true,elapsedMs:prior.elapsedMs,finalAccepted:false};
    }
    const archived=join(root,"superseded",String(Date.now()));
    await mkdir(archived,{recursive:true});
    await rename(jsonPath,join(archived,stem+".json"));
    await rename(pngPath,join(archived,stem+".png"));
  } catch(error) {if(error.code!=="ENOENT")throw error;}
  const startedAt=new Date().toISOString(), t=performance.now();
  const stepId=stem+"-"+startedAt;
  try {
    const r=await inspectMufySurfaceStep(tab,expected,{browser,height:600,deviceScaleFactor,paintWaitMs:250,nativePngEncoder,viewportMode:browser ? "browser" : undefined});
    const {pngBytes,originalBytes,...meta}=r;
    if(originalBytes){
      await writeFile(join(root,stem+".original.jpg"),originalBytes);
      meta.capture={...meta.capture,original:{path:stem+".original.jpg",sha256:hash(originalBytes)}};
    }
    await writeFile(pngPath,pngBytes);
    await writeFile(jsonPath,JSON.stringify({...meta,screenshot:{path:stem+".png",sha256:hash(pngBytes)}},null,2));
    await appendFile(join(root,"timing-runs.jsonl"),JSON.stringify({runId,stepId,kind:"browser",status:"ok",startedAt:r.startedAt,finishedAt:r.observedAt,elapsedMs:r.elapsedMs})+"\n");
    return {key:stem,reused:false,elapsedMs:r.elapsedMs,actions:r.actions.length,
      overflow:Math.max(r.host.overflowPx,...r.frames.map(f=>f.overflowPx),...r.messages.map(m=>m.overflowPx)),finalAccepted:false};
  }catch(error){
    await appendFile(join(root,"timing-runs.jsonl"),JSON.stringify({runId,stepId,kind:"browser",status:"failed",startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,error:error.message})+"\n");
    throw error;
  }
}
