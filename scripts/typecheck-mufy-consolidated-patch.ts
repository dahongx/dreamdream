/** Typecheck exact generated deployment files, retaining TEST-only dependencies.
 * Compiler overlay only: no checkout mutation and no TEST build/deploy. */
import ts from 'typescript';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const startedAt=new Date().toISOString(),tick=performance.now(),dir='outputs/mufy-consolidated-20261029';
const manifest=JSON.parse(await readFile(dir+'/runtime-manifest.json','utf8')),baseline=JSON.parse(await readFile(dir+'/baseline-manifest.json','utf8'));
const normalize=(p:string)=>resolve(p).replaceAll('\\','/').toLowerCase(),overlay=new Map<string,string>();
for(const entry of [...manifest.entries,...(baseline.readOnlyDependencies??[]).map((x:{path:string;sha256:string})=>({...x,after:x.sha256,dependency:true}))]){
 const source=await readFile(dir+(entry.dependency?'/baseline-dependencies/':'/patch/')+entry.path,'utf8');if(createHash('sha256').update(source).digest('hex')!==entry.after)throw Error('COMPILER_OVERLAY_HASH_MISMATCH:'+entry.path);overlay.set(normalize(entry.path),source);
}
const config=ts.readConfigFile('tsconfig.mufy-prefix.json',ts.sys.readFile);if(config.error)throw Error('TARGETED_CONFIG_INVALID');const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd()),options={...parsed.options,noEmit:true,incremental:false};
const host=ts.createCompilerHost(options),original={fileExists:host.fileExists,readFile:host.readFile,getSourceFile:host.getSourceFile};
host.fileExists=p=>overlay.has(normalize(p))||original.fileExists(p);
host.readFile=p=>overlay.get(normalize(p))??original.readFile(p);
host.getSourceFile=(fileName,languageVersion,onError,shouldCreateNewSourceFile)=>{const source=overlay.get(normalize(fileName));return source===undefined?original.getSourceFile(fileName,languageVersion,onError,shouldCreateNewSourceFile):ts.createSourceFile(fileName,source,languageVersion,true);};
const program=ts.createProgram(parsed.fileNames,options,host),diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)].map(d=>({code:d.code,file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:undefined,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const proof={startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,patchSha256:manifest.patchSha256,overlayFiles:overlay.size,diagnostics,exitCode:diagnostics.length?1:0,kind:'exact-patch-typecheck-process-wall-not-agent-net',agentNetMs:null,workingTreeWrites:0,remoteWrites:0,buildStarted:false,deployed:false,fullFidelityAccepted:false};
await writeFile(dir+'/patch-typecheck.json',JSON.stringify(proof,null,2));await appendFile('logs/mufy-profiles/full-20261013/next-batch-30-20261028/timing-runs.jsonl',JSON.stringify({id:'exact-patch-typecheck-'+proof.observedAt,...proof})+'\n');console.log(JSON.stringify(proof));if(diagnostics.length)process.exitCode=1;
