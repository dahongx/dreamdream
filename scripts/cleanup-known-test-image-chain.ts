// Only the verified TEST build intermediate's parent chain. No prune/force.
const ssh=['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const out=await new Response(p.stdout).text();if(await p.exited)throw Error('STOPPED');return out.trim();}
let id='sha256:d929551add169b08bfbd33630851cc5f55ad8644f4a2dee21161d1a47fb76ffe';
for(let n=0;n<30 && id;n++){
 if(!/^sha256:[a-f0-9]{64}$/.test(id))throw Error('INVALID_ID');
 const metadata=(await run(`docker image inspect ${id} --format '{{json .RepoTags}}|{{json .RepoDigests}}|{{.Parent}}'`)).split('|');
 if(JSON.parse(metadata[0])?.length || JSON.parse(metadata[1])?.length)break;
 if(await run(`docker ps -a --filter ancestor=${id} --format '{{.Names}}'`))break;
 const parent=metadata[2];
 console.log(await run(`docker image rm ${id}`));
 id=parent;
 const free=Number(await run("df -Pk / | awk 'NR==2 {print $4}'"));
 if(free>=21*1024*1024)break;
}
console.log(await run('df -Pk /'));
