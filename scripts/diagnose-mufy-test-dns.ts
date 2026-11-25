/** User-authorized read-only TEST diagnostics. No env/credential reads,
 * database connections, database commands, or infrastructure mutations. */
import {writeFile} from 'node:fs/promises';
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
const startedAt=new Date().toISOString(),start=performance.now();
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'pipe'});const stdout=await new Response(p.stdout).text();const exit=await p.exited;if(exit>1)throw Error('READ_ONLY_DIAGNOSTIC_COMMAND_FAILED:'+exit);return stdout.trim();}
const port=await read('cd /root/projects/yearn-chat && docker compose port app 3000');if(port!=='0.0.0.0:8091')throw Error('EXACT_TEST_PORT_REQUIRED');
// Extract hostname metadata only; never return SQL, request bodies, prompts,
// environment variables, headers or connection strings from server logs.
const metadata=await read(`cd /root/projects/yearn-chat && docker compose logs --since 2h --no-color app 2>&1 | sed -E 's/\\x1B\\[[0-9;]*[mK]//g' | grep -Eo 'hostname:[^a-zA-Z0-9]*[a-zA-Z0-9_.-]+|getaddrinfo ENOTFOUND [a-zA-Z0-9_.-]+' | sort -u`);
const hosts=[...metadata.matchAll(/(?:hostname:[^a-zA-Z0-9]*|getaddrinfo ENOTFOUND )([a-zA-Z0-9_.-]+)/g)].map(m=>m[1]);
const errorClasses=await read(`cd /root/projects/yearn-chat && docker compose logs --since 2h --no-color app 2>&1 | grep -Eo 'ENOTFOUND|EAI_AGAIN|ECONNREFUSED|Failed query' | sort | uniq -c`);
const resolvers=await read('cd /root/projects/yearn-chat && docker compose exec -T app cat /etc/resolv.conf');
const networks=await read(`cd /root/projects/yearn-chat && docker inspect yearn-chat-app-1 --format '{{range .NetworkSettings.Networks}}{{.NetworkID}} {{.Gateway}} {{.IPAddress}}{{println}}{{end}}'`);
const results=[];
for(const hostname of [...new Set([...hosts,'example.com'])]){
 if(!/^[a-zA-Z0-9.-]+$/.test(hostname))throw Error('INVALID_DNS_TARGET');
 const hostAnswer=await read(`getent ahostsv4 ${hostname} | head -n 1`);
 const code=`const d=await import("node:dns/promises");try{const a=await d.lookup(${JSON.stringify(hostname)});console.log(JSON.stringify({resolved:true,family:a.family}));}catch(e){console.log(JSON.stringify({resolved:false,code:e.code}));}`;
 const appAnswer=await read(`cd /root/projects/yearn-chat && docker compose exec -T app bun -e '${code}'`);
 const category=hostname==='example.com'?'public-control':hostname.includes('supabase')?'supabase-dns-target':'other-app-dns-target';
 results.push({category,hostname,hostResolves:!!hostAnswer,appAnswer});
}
const report={scope:'TEST',port:8091,startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,errorClasses,errorHostnamesObserved:hosts.length,resolvers,networks,results,credentialReads:0,databaseConnections:0,mutations:0};
await writeFile('logs/mufy-profiles/full-20261013/pilot-5/stream-regression-20261021/read-only-dns-diagnostic.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
