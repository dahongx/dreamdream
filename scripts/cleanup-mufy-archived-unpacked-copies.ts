/** Remove only redundant unpacked copies, verified against complete retained result tarballs. */
import {writeFile} from 'node:fs/promises';
const names=['20261015023340625','20261015022937624','20261015022521175'];
const root='/root/mufy-transfer-archive-20261015';
const tick=performance.now(),startedAt=new Date().toISOString();
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
${names.map(n=>{const d=`${root}/mufy-batch-${n}`,a=`${d}-results.tar.gz`;return `test "$(readlink -f '${d}')" = '${d}'
test -d '${d}'
test -f '${a}'
test -z "$(find '${d}' -type l -print -quit)"
tar -dzf '${a}' -C '${d}'
test "$(tar -tzf '${a}' | sed 's#^./##;s#/$##' | sort)" = "$(cd '${d}' && find . -print | sed 's#^./##;s#^.$##' | sort)"`;}).join('\n')}
df -Pk /
${names.map(n=>`rm -r -- '${root}/mufy-batch-${n}'`).join('\n')}
df -Pk /`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mufy-opening-height-20261028/redundant-unpacked-cleanup.json',JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-cleanup-wall-not-agent-net',names,stdout,stderr,exitCode,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'Extract retained corresponding -results.tar.gz into original directory; tar compare and complete name inventory verified before removal'},null,2));
console.log(JSON.stringify({stdout,stderr,exitCode}));if(exitCode)process.exitCode=1;
