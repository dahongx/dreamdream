/** Extract exactly the five authorized local archive inputs. No Mufy private access or network. */
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {parseMufyPrompt} from '../src/lib/import/mufy-migration';
const base=resolve('logs/mufy-profiles/full-20261013'),root=join(base,'next-batch-5-20261019');
const startedAt=new Date().toISOString(),t=performance.now();
const manifest=JSON.parse(await readFile(join(base,'next-batch-5-20261019.json'),'utf8')) as {timing:{startedAt:string};rows:Array<{name:string;sourceKey:string}>};
const sources=JSON.parse(await readFile(join(base,'sources.json'),'utf8')) as Array<{key:string;name:string;promptSha256:string}>;
const wanted=new Map(manifest.rows.map(r=>{const source=sources.find(s=>s.key===r.sourceKey);if(!source)throw Error('LOCAL_SOURCE_ID_MISSING:'+r.sourceKey);return[r.sourceKey,{...r,promptSha256:source.promptSha256}];}));
const {archive}=JSON.parse(await readFile(join(base,'job.json'),'utf8')) as {archive:string};
const child=spawn('D:/program/anaconda3/Library/bin/zstd.exe',['-dc',archive]);child.stderr.resume();
const done=new Promise<void>((ok,fail)=>{child.once('error',fail);child.once('close',c=>c===0?ok():fail(Error('LOCAL_ARCHIVE_READ_FAILED:'+c)));});
const rows=[];
for await(const line of createInterface({input:child.stdout,crlfDelay:Infinity})){
 const record=JSON.parse(line) as {character_key:string;character_name:string;text:string};const selected=wanted.get(record.character_key);if(!selected)continue;
 const digest=createHash('sha256').update(record.text).digest('hex');if(digest!==selected.promptSha256)throw Error('LOCAL_SOURCE_FINGERPRINT_MISMATCH:'+selected.sourceKey);
 const dir=join(root,'local-inputs',selected.sourceKey);await mkdir(dir,{recursive:true});
 const path=join(dir,'prompt.txt');
 if(await Bun.file(path).exists()){if(createHash('sha256').update(await readFile(path)).digest('hex')!==digest)throw Error('EXISTING_INPUT_CHANGED:'+selected.sourceKey);}
 else await writeFile(path,record.text,{mode:0o600});
 const fields=parseMufyPrompt(record.text);
 rows.push({name:selected.name,sourceKey:selected.sourceKey,promptSha256:digest,characterName:record.character_name,promptCharacters:record.text.length,sectionLengths:Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,typeof value==='string'?value.length:0])),source:'user-provided-local-archive',notLatestHiddenMufyPrompt:true,serverWrites:0});
}
await done;if(rows.length!==5)throw Error('EXACT_FIVE_LOCAL_ARCHIVE_RECORDS_REQUIRED:'+rows.length);
await writeFile(join(root,'local-input-inventory.json'),JSON.stringify({startedAt,finishedAt:new Date().toISOString(),scope:'User-provided original local archive only, matched exact source key and SHA256. Prompt bodies are saved locally but never printed or uploaded by this step.',rows},null,2));
await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({runId:manifest.timing.startedAt,stepId:'local-archive-stage-'+startedAt,kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok'})+'\n');
console.log(JSON.stringify({staged:rows.length,rows:rows.map(r=>({name:r.name,sourceKey:r.sourceKey,promptCharacters:r.promptCharacters,verified:true})),serverWrites:0},null,2));
