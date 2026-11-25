/** Authorized old TEST image cleanup only. No prune, force, volumes, DB or credentials. */
import {writeFile} from 'node:fs/promises';
const startedAt=new Date().toISOString(),start=performance.now();
const reportPath='logs/mufy-profiles/full-20261013/pilot-5/stream-regression-20261021/authorized-image-cleanup.json';
async function run(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);return {stdout:stdout.trim(),stderr:stderr.trim(),exitCode};}
async function read(command:string){const r=await run(command);if(r.exitCode!==0)throw Error('PRECHECK_FAILED:'+r.exitCode);return r.stdout;}
const keep=['yearn-chat-app:latest','yearn-chat-app:stream-before-20261021065136229','yearn-chat-app:statusbar-before-20261021041243056'];
const targets=['shared-style-before-20261020213557511','component-fallbacks-before-20261020191012343','before-model-status-20261019','native-table-before-20261019120148525','native-table-before-20261019120359000','message-surface-before-20261019025649863','message-surface-before-20261019030133892','before-refusal-20261019','mufy-source-before-20261015075009696','mufy-source-before-20261015063923454','mufy-source-before-20261015055333949','mufy-source-before-20261015053644961'].map(t=>'yearn-chat-app:'+t);
const actions:Array<{ref:string;id:string;status:string;output?:string}>=[];
const report:{[key:string]:unknown}={startedAt,scope:'TEST-8091-exact-old-image-tags',keep,actions,databaseConnections:0,volumeChanges:0,forceUsed:false};
try{
 if(await read('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('EXACT_TEST_PORT_REQUIRED');
 report.beforeDisk=await read('df -h /');
 const keepIds=await Promise.all(keep.map(ref=>read(`docker image inspect ${ref} --format '{{.Id}}'`)));
 report.preservedImages=keep.map((ref,i)=>({ref,id:keepIds[i]}));
 const containers=(await read("docker ps -aq --no-trunc")).split(/\r?\n/).filter(Boolean);
 const usedIds=new Set<string>();
 for(const id of containers){if(!/^[a-f0-9]{64}$/.test(id))throw Error('INVALID_CONTAINER_ID');usedIds.add(await read(`docker inspect ${id} --format '{{.Image}}'`));}
 for(const ref of targets){
  const r=await run(`docker image inspect ${ref} --format '{{.Id}}'`);
  if(r.exitCode!==0){if(r.exitCode===255)throw Error('SSH_DISCONNECTED_DURING_PRECHECK');actions.push({ref,id:'',status:'already-absent'});continue;}
  const id=r.stdout;
  if(!/^sha256:[a-f0-9]{64}$/.test(id))throw Error('INVALID_IMAGE_ID');
  actions.push({ref,id,status:keepIds.includes(id)?'protected-rollback':usedIds.has(id)?'container-in-use':'approved-for-removal'});
 }
 await writeFile(reportPath,JSON.stringify(report,null,2));
 for(const action of actions){
  if(action.status!=='approved-for-removal')continue;
  const r=await run(`docker image rm ${action.ref}`);
  action.status=r.exitCode===0?'removed':'refused-or-failed';action.output=r.stdout||r.stderr;
  await writeFile(reportPath,JSON.stringify(report,null,2));
  if(r.exitCode!==0)throw Error('CLEANUP_STOPPED_ON_FAILURE');
 }
 report.afterDisk=await read('df -h /');
 report.remainingImages=await read("docker images --filter reference='yearn-chat-app*' --format '{{.Repository}}:{{.Tag}} | {{.ID}}'");
 report.ok=true;
}finally{report.finishedAt=new Date().toISOString();report.elapsedMs=performance.now()-start;await writeFile(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
