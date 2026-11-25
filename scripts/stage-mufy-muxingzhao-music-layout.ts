/** Rank 42 only: preserve the measured source music canvas, not a global sizing change. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/42';
const baseline=await readFile(root+'/owner-opening-baseline.txt','utf8');
const evidence=JSON.parse(await readFile(root+'/music-layout-before.json','utf8'));
if(evidence.rank!==42||evidence.source.body.display!=='flex'||evidence.source.body.minHeight!=='150px'||evidence.target.body.display!=='flow-root')throw Error('SOURCE_LAYOUT_EVIDENCE_MISMATCH');
const title='<title>清新音乐播放器</title>',start=baseline.indexOf(title),end=baseline.indexOf('</body>',start);
if(start<0||end<start||baseline.indexOf(title,start+title.length)>=0||baseline.includes('data-mufy-measured-music-canvas'))throw Error('UNIQUE_UNREPAIRED_MUSIC_FRAME_REQUIRED');
const addition='<style data-mufy-measured-music-canvas>body[data-nj-opening-canvas]{display:flex;min-height:150px!important}body[data-nj-opening-canvas]>[data-nj-doc]{display:contents}</style>\n';
const candidate=baseline.slice(0,end)+addition+baseline.slice(end);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(root+'/candidate-opening.txt',candidate);
const proof={observedAt:new Date().toISOString(),rank:42,baselineSha256:hash(baseline),candidateSha256:hash(candidate),insertedCharacters:addition.length,preservedOriginalCharacters:baseline.length,allOriginalCharactersPreserved:candidate.replace(addition,'')===baseline,scope:'single existing music source document only; measured source 150px/flex retained; no resource, prompt, program or global runtime change',ownerUiSaved:false,fullFidelityAccepted:false};
await writeFile(root+'/music-layout-candidate-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
