/** Read-only SSH transport-phase diagnostic. Persist only an allowlist of non-secret phase messages. */
import {writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const child=Bun.spawn(['ssh','-v','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73','true'],{stdout:'ignore',stderr:'pipe'});
const [diagnostic,exitCode]=await Promise.all([new Response(child.stderr).text(),child.exited]);
const safeLines=diagnostic.split(/\r?\n/).filter(line=>/^(debug1: (Connecting to |Connection established\.|Local version string |Remote protocol version |SSH2_MSG_KEXINIT (sent|received))|kex_exchange_identification:|banner exchange:|Connection (closed|timed out|refused)|ssh: connect to host)/.test(line));
const proof={observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,exitCode,safeLines,scope:'Transport negotiation only; no server state, env, logs, credentials, files or database read. Raw verbose diagnostic is not persisted.',remoteMutationCommand:false,agentNetMs:null};
await writeFile(`${root}/ssh-transport-phase-20261102.json`,JSON.stringify(proof,null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({kind:'ssh-transport-phase-process-wall',...proof})+'\n');
console.log(JSON.stringify(proof));
