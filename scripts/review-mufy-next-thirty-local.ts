/** Read user-owned archive for scope review. No source transfer, packaging or DB. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {parseMufyPrompt} from '../src/lib/import/mufy-migration';
const base='logs/mufy-profiles/full-20261013',root=`${base}/next-batch-30-20261028`;
const startedAt=new Date().toISOString(),tick=performance.now();
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8')) as {rows:{rank:number;name:string;sourceKey:string}[]};
const sources=JSON.parse(await readFile(`${base}/sources.json`,'utf8')) as {key:string;promptSha256:string}[];
const job=JSON.parse(await readFile(`${base}/job.json`,'utf8')) as {archive:string};
const wanted=new Map(manifest.rows.map(r=>[r.sourceKey,r]));
const child=spawn('D:/program/anaconda3/Library/bin/zstd.exe',['-dc',job.archive]);child.stderr.resume();
const done=new Promise<void>((ok,fail)=>{child.once('error',fail);child.once('close',c=>c===0?ok():fail(Error('ARCHIVE_READ_FAILED')))});
const rows=[];
for await(const line of createInterface({input:child.stdout,crlfDelay:Infinity})){
 const record=JSON.parse(line) as {character_key:string;text:string};const r=wanted.get(record.character_key);if(!r)continue;
 const hash=createHash('sha256').update(record.text).digest('hex');
 if(sources.find(s=>s.key===r.sourceKey)?.promptSha256!==hash)throw Error('FINGERPRINT_MISMATCH');
 const fields=parseMufyPrompt(record.text);const persona=fields.persona??'';
 const ageFacts=[...persona.matchAll(/.{0,12}(?:年龄|年齡|Age|\b(?:1[0-9]|[2-9][0-9])岁).{0,35}/gi)].slice(0,8).map(m=>m[0]);
 const relationshipFacts=[...persona.matchAll(/[^\n。]{0,45}(?:与|和|对|與|跟)(?:\{\{)?(?:user|用户|玩家)(?:\}\})?[^\n。]{0,65}/gi)].slice(0,8).map(m=>m[0]);
 const familyFacts=[...persona.matchAll(/[^\n。]{0,55}(?:亲生妹妹|亲生姐姐|亲哥|亲弟|亲姐|同父异母|同母异父|兄妹|姐弟|继父|继母|养父|养母|嫂子|姐夫|弟媳|女儿|儿子|侄女|侄子)[^\n。]{0,70}/g)].slice(0,15).map(m=>m[0]);
 rows.push({...r,sha256:hash,ageFacts,relationshipFacts,familyFacts,personaChars:persona.length,openingChars:fields.opening?.length??0,scopeStatus:'requires-semantic-review-not-auto-approved'});
}
await done;if(rows.length!==30)throw Error('EXPECTED_30');rows.sort((a,b)=>a.rank-b.rank);
await writeFile(`${root}/local-scope-review-facts.json`,JSON.stringify({startedAt,observedAt:new Date().toISOString(),rows,sourceUploaded:false,prepared:false},null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({step:'read-local-scope-facts',kind:'local-processing',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,containsWait:true,waitType:'archive-io',agentNetMs:null})+'\n');
console.log(JSON.stringify(rows.map(r=>({rank:r.rank,name:r.name,age:r.ageFacts[0],familyFacts:r.familyFacts})),null,2));
