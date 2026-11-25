import {writeFile} from 'node:fs/promises';
const startedAt=new Date().toISOString(),start=performance.now();
const script=`set -eu
cd /root/projects/yearn-chat
docker compose port app 3000 | grep -qx '0.0.0.0:8091'
docker image ls -aq --no-trunc | sort -u | xargs -r docker image inspect --format '{"id":{{json .Id}},"parent":"","tags":{{json .RepoTags}},"created":{{json .Created}},"workdir":{{json (index .Config "WorkingDir")}},"layers":{{json .RootFS.Layers}}}'
`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73','sh -s'],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});p.stdin.write(script);p.stdin.end();
const [out,err,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(exit)throw Error('AUDIT_FAILED:'+exit+':'+err.slice(0,1200));
type Image={id:string;parent:string;tags:string[]|null;created:string;workdir:string;layers:string[]};
const images=out.trim().split(/\r?\n/).map(s=>JSON.parse(s) as Image);
const app=images.find(i=>i.tags?.includes('yearn-chat-app:latest'))!;
const base=images.find(i=>i.tags?.includes('oven/bun:1.3-alpine'))!;
const candidates=images.filter(i=>!i.tags?.length&&Date.parse(i.created)>=Date.parse('2026-10-15T00:00:00Z')).map(i=>{let prefix=0;while(prefix<Math.min(i.layers.length,app.layers.length)&&i.layers[prefix]===app.layers[prefix])prefix++;return {...i,appCommonLayers:prefix,commonBeyondBase:prefix>base.layers.length};});
await writeFile('logs/mufy-profiles/full-20261013/pilot-5/stream-regression-20261021/build-image-audit.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,images,candidates,baseLayerCount:base.layers.length},null,2));
console.log(JSON.stringify({total:images.length,baseLayerCount:base.layers.length,appLayerCount:app.layers.length,candidateCount:candidates.length,matchingBeyondBase:candidates.filter(i=>i.commonBeyondBase).length,prefixCounts:candidates.reduce((a,i)=>{a[i.appCommonLayers]=(a[i.appCommonLayers]??0)+1;return a;},{} as Record<number,number>),sample:candidates.slice(0,5)}));
