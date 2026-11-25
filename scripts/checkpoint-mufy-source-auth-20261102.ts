import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const proof=JSON.parse(await readFile(`${root}/source-auth-required-20261102.json`,'utf8'));
if(proof.status!=='AUTH_REQUIRED'||proof.roleUnavailableProven||proof.credentialReads!==0)throw Error('AUTH_PROOF_INVALID');
const observedAt=new Date().toISOString();
const pending={evidence:'source-auth-required-20261102.json',status:'awaiting-normal-user-login',notificationKey:'mufy-chrome-auth-expired-20261102',notifiedAt:observedAt,requestSent:true,roleDownlistedProven:false,sourceRetries:0};
for(const file of ['qa-progress.json','continuation-next-20261031.json']){const data=JSON.parse(await readFile(`${root}/${file}`,'utf8'));data.observedAt=observedAt;data.sourceLogin=pending;if(file.startsWith('continuation'))data.currentNextAction='Source Mufy explicitly reports expired login. Wait for normal user login before further source reads; do not infer downlisting or retry auth. Preserve completed rank49 all22 commands/mode/group checks and restored empty draft; rank35 three-tab desktop/mobile and25 exact original URLs; rank41 actual settled friend switching. Source-body/style comparison remains pending. No unchanged rebuild or unverified clipboard deployment.';await writeFile(`${root}/${file}`,JSON.stringify(data,null,2));}
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'source-auth-checkpoint-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,authRetries:0})+'\n');
console.log(JSON.stringify(pending));
