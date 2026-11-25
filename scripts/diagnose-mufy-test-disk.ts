/** Read-only disk accounting. No file contents, credentials, DB connections or deletion. */
import {writeFile} from 'node:fs/promises';
const startedAt=new Date().toISOString(),start=performance.now();
async function read(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});const out=await new Response(p.stdout).text();const exit=await p.exited;if(exit!==0)throw Error('READ_ONLY_DISK_CHECK_FAILED:'+exit);return out.trim();}
if(await read('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('EXACT_TEST_PORT_REQUIRED');
const [dockerUsage,directoryUsage,testImages]=await Promise.all([
 read('docker system df'),
 read('for p in /var/lib/docker/buildkit /var/lib/docker/overlay2 /var/lib/containerd /root/mufy-transfer-archive-20261015 /root/projects/yearn-chat; do if test -d "$p"; then du -sh "$p"; fi; done'),
 read(`docker images --filter reference='yearn-chat*' --format '{{.Repository}}:{{.Tag}} | {{.ID}} | {{.CreatedAt}} | {{.Size}}'`),
]);
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,scope:'TEST-host-read-only-disk-metadata',dockerUsage,directoryUsage,testImages,mutations:0,databaseConnections:0,credentialReads:0};
await writeFile('logs/mufy-profiles/full-20261013/pilot-5/stream-regression-20261021/read-only-disk-usage.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
