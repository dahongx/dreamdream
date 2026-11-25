/** TEST-only, read-only structured chat telemetry; no prompts, credentials or DB. */
import {writeFile} from 'node:fs/promises';
const startedAt=new Date().toISOString();
const command=String.raw`set -eu
cd /root/projects/yearn-chat
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
docker compose logs --no-color --since 90m app 2>&1 | sed -n \
  -e 's/.*\[chat\] finished model=\([^ ]*\) finishReason=\([^ ]*\) text=\([0-9]*\)chars.*+\([0-9]*\)ms.*/FINISH model=\1 reason=\2 chars=\3 elapsedMs=\4/p' \
  -e 's/.*\[chat\] gemini stream error model=\([^ ]*\) +\([0-9]*\)ms:.*/STREAM_ERROR model=\1 elapsedMs=\2/p' \
  -e 's/.*\[chat\] UI stream error model=\([^ ]*\) sessionId=[^ ]* +\([0-9]*\)ms:.*/UI_STREAM_ERROR model=\1 elapsedMs=\2/p' \
  -e 's/.*\[chat\] UI stream error .*ms: \([A-Za-z]*Error\):.*/UI_ERROR_CLASS=\1/p'`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const output=await new Response(p.stdout).text();
const exitCode=await p.exited;
// Do not print arbitrary SSH/server output. Only the explicitly whitelisted fields survive.
const rows=output.split(/\r?\n/).filter(x=>/^(FINISH model=[\w./:-]+ reason=[\w-]+ chars=\d+ elapsedMs=\d+|(?:UI_)?STREAM_ERROR model=[\w./:-]+ elapsedMs=\d+|UI_ERROR_CLASS=[A-Za-z]*Error)$/.test(x));
const report={startedAt,observedAt:new Date().toISOString(),exitCode,rows,readOnly:true,databaseTouched:false,productionTouched:false,rawLogsExported:false};
await writeFile('logs/mufy-profiles/full-20261013/next-batch-30-20261028/structured-stream-diagnosis.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
