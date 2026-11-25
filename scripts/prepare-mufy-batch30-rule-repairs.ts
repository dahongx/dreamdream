/** Offline only. Keep imported baselines and live chat history untouched. */
import { readFile, readdir, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sourceRuleTransfer } from '../src/lib/import/mufy-source-rule-transfer';
import {buildMufyPublicSemanticSkin} from '../src/lib/import/mufy-public-semantic-skin';
import { applyMufySourceRules, prepareMufySourceRules } from '../src/lib/import/mufy-source-rules';
import { parseExternalCharacterXml, parseExternalRulesJson } from '../src/lib/import/external-card';
import { sha256 } from '../src/lib/import/mufy-migration';

const root=resolve('logs/mufy-profiles/full-20261013/next-batch-30-20261028');
if(process.argv[2]==='--worker'){
  const capture=JSON.parse(await readFile(process.argv[3],'utf8'));
  const raw=await readFile(process.argv[4],'utf8');
  const result=applyMufySourceRules(raw,prepareMufySourceRules(capture,capture.roleId));
  await writeFile(process.argv[5],result.html,'utf8');
  console.log(JSON.stringify({matchedRules:result.matchedRules,unmatchedRuleIds:result.unmatchedRuleIds,outputChars:result.html.length}));
}else{
  const start=performance.now(),startedAt=new Date().toISOString();
  const receipts=JSON.parse(await readFile(join(root,'normal-ui-import-receipts.json'),'utf8')).rows;
  const previous=await Bun.file(join(root,'rule-repair-preparation.json')).exists()?JSON.parse(await readFile(join(root,'rule-repair-preparation.json'),'utf8')).rows:[];
  const files=await readdir(join(root,'source-rules'));
  const rows=[];
  for(const row of receipts){
    const roleId=new URL(row.sourceUrl).searchParams.get('roleId');
    if(!roleId)throw Error('MISSING_SOURCE_ROLE_ID');
    const file=files.find(f=>f===`${row.rank}-${roleId}.json`);
    if(!file){rows.push({rank:row.rank,status:'awaiting-normal-page-rule-response'});continue;}
    const capturePath=join(root,'source-rules',file);
    const capture=JSON.parse(await readFile(capturePath,'utf8'));
    const prepared=JSON.parse(await readFile(join(root,'prepared',row.sourceKey,'prepared.json'),'utf8'));
    const assets=JSON.parse(await readFile(join(root,row.sourceKey+'-public-render-assets.json'),'utf8'));
    const speechAvatar=assets.images.some((i:{alt:string})=>i.alt==='avatar')?prepared.character.avatarUrl:undefined;
    const appearancePath=join(root,'public-semantic-appearance',`${row.rank}-${roleId}.json`);
    const appearance=await Bun.file(appearancePath).exists()?buildMufyPublicSemanticSkin(JSON.parse(await readFile(appearancePath,'utf8')),roleId):undefined;
    const source=sourceRuleTransfer(capture,roleId,prepared.beautification.globalCss??'',speechAvatar,appearance?.nativeTextColor);
    const baseline=await readFile(join(root,'prepared',row.sourceKey,'ui-import.xml'),'utf8');
    const parsed=parseExternalCharacterXml(baseline);
    if(!parsed.ok)throw Error(`invalid-import-baseline:${row.rank}`);
    // Only a rules-only owner UI import, never a second character import.
    const existing=parsed.value.rules.map(r=>({ruleName:r.name,regexPattern:r.pattern,replaceString:r.replacement,enabled:r.enabled,visibility:r.visible}));
    const rules=[...source.rules,...existing];
    if(rules.length&&!parseExternalRulesJson(JSON.stringify(rules)).ok)throw Error(`rules-roundtrip:${row.rank}`);
    const dir=join(root,'rule-repairs',String(row.rank));await mkdir(dir,{recursive:true});
    const rulesText=JSON.stringify(rules,null,2)+'\n';await writeFile(join(dir,'rules-only.json'),rulesText);
    await writeFile(join(dir,'source-chain-only.json'),JSON.stringify(source.rules,null,2)+'\n');
    if(appearance)await writeFile(join(dir,'host-semantic-repair.css'),(prepared.beautification.globalCss??'')+appearance.hostCss);
    const candidates=await readdir(root);
    const rawFiles=candidates.filter(f=>new RegExp(`^${row.rank}-gemini4-reply[12]-raw\\.txt$`).test(f));
    const legacy=row.rank===21?'fusiyan':row.rank===22?'jiangzhi':row.rank===23?'xujianghe':null;
    if(legacy)for(const f of candidates.filter(f=>new RegExp(`^${legacy}-gemini4-reply[12]-raw\\.txt$`).test(f))){
      const round=f.match(/reply([12])/)!;
      if(!rawFiles.some(name=>name.includes(`reply${round[1]}`)))rawFiles.push(f);
    }
    if(row.rank===24&&candidates.includes('24-sonnet-reply2-restored-after-reload.txt')){
      const old=rawFiles.indexOf('24-gemini4-reply2-raw.txt');
      if(old>=0)rawFiles.splice(old,1);
      rawFiles.push('24-sonnet-reply2-restored-after-reload.txt');
    }
    const trials=process.argv.includes('--rules-only')?(previous.find((r:{rank:number})=>r.rank===row.rank)?.trials??[]):[];
    for(const rawFile of process.argv.includes('--rules-only')?[]:rawFiles){
      const rendered=join(dir,rawFile.replace(/\.txt$/,'.source-rendered.txt'));
      // Bound untrusted regular expressions in a killable subprocess.
      const proc=spawnSync(process.execPath,[import.meta.path,'--worker',capturePath,join(root,rawFile),rendered],{encoding:'utf8',timeout:5000,maxBuffer:1024*1024,windowsHide:true});
      if(proc.error||proc.status!==0){trials.push({rawFile,status:'transform-failed-or-timeout'});continue;}
      trials.push({rawFile,status:'offline-transform-only',...JSON.parse(proc.stdout)});
    }
    rows.push({rank:row.rank,name:row.name,ruleCount:source.ruleCount,publicSpeechAvatar:!!speechAvatar,captureSha256:sha256(await readFile(capturePath,'utf8')),baselineSha256:sha256(baseline),repairRulesSha256:sha256(rulesText),rulesFile:join(dir,'rules-only.json'),trials,liveApplied:false,fullFidelityAccepted:false});
  }
  const report={scope:'offline-rule-repair-staging-only',startedAt,finishedAt:new Date().toISOString(),rows,liveWrites:0,fullFidelityAccepted:false};
  await writeFile(join(root,'rule-repair-preparation.json'),JSON.stringify(report,null,2)+'\n');
  await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({label:'offline-rule-repair-staging',startedAt,observedAt:report.finishedAt,elapsedMs:performance.now()-start,category:'local-processing-wall',agentNetMs:null})+'\n');
  console.log(JSON.stringify(rows.map(r=>({rank:r.rank,ruleCount:r.ruleCount,trials:r.trials,status:r.status})),null,2));
}
