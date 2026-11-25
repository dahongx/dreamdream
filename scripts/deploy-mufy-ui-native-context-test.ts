/** TEST 8091 only. Preserve data/volumes; deploy the four-file UI compatibility fix. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
if(!process.argv.includes('--commit-test'))throw Error('--commit-test required');
const files=['src/lib/import/mufy-native-table.ts','src/components/chat/mufy-shared-component-context.ts','src/components/chat/ChatMessagesList.tsx','src/components/chat/MessageBubble.tsx'];
const source=await Promise.all(files.map(f=>readFile(f,'utf8')));
const before=[
 source[0].slice(0,source[0].indexOf('\n/** New normal-UI imports'))+'\n',
 source[1].slice(0,source[1].indexOf('/** Per-chat source compatibility')),
 source[2].replace('hasMufyAdaptedComponent, hasMufyRenderedOpening','hasMufyRenderedOpening').replace('MufyNativeSourceContext, MufySharedComponentStyleContext','MufySharedComponentStyleContext').replace('  const nativeSource=useMemo(()=>hasMufyRenderedOpening(rules)||hasMufyAdaptedComponent(openingComponents),[rules,openingComponents]);\n','').replace("nativeSource?collectMufySharedComponentStyle(openingComponents):'', [nativeSource,openingComponents]","hasMufyRenderedOpening(rules)?collectMufySharedComponentStyle(openingComponents):'', [rules,openingComponents]").replace('    <MufyNativeSourceContext.Provider value={nativeSource}>\n','').replace('    </MufyNativeSourceContext.Provider>\n',''),
 source[3].replace('MufyNativeSourceContext, MufySharedComponentStyleContext','MufySharedComponentStyleContext').replace('  const nativeSource=useContext(MufyNativeSourceContext);\n','').replace('nativeSource||hasMufyRenderedOpening(rules), [nativeSource,rules]','hasMufyRenderedOpening(rules), [rules]'),
];
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const expected=before.map(sha),candidate=source.map(sha),ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false){const p=Bun.spawn(args,{stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('TEST_COMMAND_FAILED');return out.trim();}
const startedAt=new Date().toISOString(),t=performance.now(),stamp=startedAt.replace(/\D/g,''),root='logs/mufy-profiles/full-20261013/next-batch-5-20261019',backup=`/root/mufy-transfer-archive-20261015/ui-native-${stamp}`;
let ok=false;const cleanups:unknown[]=[];
try{
 if(await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true)!=='0.0.0.0:8091')throw Error('WRONG_TEST_PORT');
 const actual=(await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true)).split(/\r?\n/).map(s=>s.split(/\s/)[0]);
 if(actual.length!==files.length)throw Error('REMOTE_BASELINE_CHANGED');
 for(let i=0;i<files.length;i++){
  if(actual[i]===expected[i])continue;
  const remote=await run([...ssh,`cat /root/projects/yearn-chat/${files[i]}`],true);
  if(remote.replace(/\r\n/g,'\n').trimEnd()!==before[i].replace(/\r\n/g,'\n').trimEnd())throw Error('REMOTE_BASELINE_CHANGED:'+files[i]);
  expected[i]=actual[i];
 }
 const used=(await run([...ssh,"docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}'"],true)).split(/\r?\n/);
 const keep=(await run([...ssh,"docker image inspect yearn-chat-app:latest yearn-chat-app:ui-import-before-20261022042038463 --format '{{.Id}}'"],true)).split(/\r?\n/);
 const targets=[['yearn-chat-app:stream-before-20261021065136229','sha256:04e1c515073abbfe265e25940cdc9b7c3105fe6d30d9a2a2e29be7708ddfc659'],['yearn-chat-app:sidebar-before-20261021095302705','sha256:ffd32c836a1043a724820bbd1a2cb50edbddb0a654c5cd40241215bae50fc6ef']];
 for(const [tag,id] of targets){
  if(used.includes(id)||keep.includes(id)||await run([...ssh,`docker image inspect ${tag} --format '{{.Id}}'`],true)!==id)throw Error('PROTECTED_OLD_IMAGE');
  const output=await run([...ssh,`docker image rm ${tag}`],true);cleanups.push({tag,id,output,recovery:'Retained source archives allow rebuilding; removed old image is not instantly restorable.'});
 }
 await requireTestDiskCapacity(run,ssh);
 const archive=`${root}/ui-native-${stamp}.tar`;await run(['tar','-cf',archive,...files]);
 await run([...ssh,`umask 077; mkdir -p ${backup}`]);await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
 await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files.join(' ')}; docker tag yearn-chat-app yearn-chat-app:ui-native-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 25 ${backup}/build.log; exit 1; fi`]);
 const after=(await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true)).split(/\r?\n/).map(s=>s.split(/\s/)[0]);
 if(after.some((v,i)=>v!==candidate[i])||after.length!==files.length)throw Error('DEPLOYED_BYTES_MISMATCH');ok=true;
}finally{
 const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,ok,files,expected,candidate,backup,cleanups,databaseCommands:0,volumeChanges:0,productionWrites:0};
 await writeFile(`${root}/ui-native-${stamp}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
