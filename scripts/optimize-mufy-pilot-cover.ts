import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const root = "logs/mufy-profiles/full-20261013/pilot-5";
const manifest = JSON.parse(await readFile(join(root,"manifest.json"),"utf8"));
for(const row of manifest.rows){
  const runtime = JSON.parse(await readFile(row.runtimePath,"utf8"));
  const asset = runtime.assets.find((a:{url:string;contentType:string;size:number})=>a.url===runtime.detail.data.backgroundUrl && a.contentType==="image/gif" && a.size>4*1024*1024);
  if(!asset)continue;
  const input=join(root,row.sourceKey,"cover-source.gif"),output=join(root,row.sourceKey,"cover-optimized.gif");
  await writeFile(input,Buffer.from(asset.dataUrl.split(',')[1],"base64"));
  const start=performance.now();
  const p=Bun.spawn(["D:/code/aiagent/ffmpeg-master-latest-win64-gpl-shared/bin/ffmpeg.exe","-hide_banner","-loglevel","error","-y","-i",input,"-vf","fps=8,scale=240:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=none:diff_mode=rectangle","-loop","0",output],{stdout:"inherit",stderr:"inherit"});
  if(await p.exited)throw Error("GIF optimization failed");
  const bytes=await readFile(output);
  if(bytes.length>4*1024*1024)throw Error("Optimized GIF still exceeds conservative storage budget");
  asset.originalSize=asset.size;asset.size=bytes.length;asset.dataUrl="data:image/gif;base64,"+bytes.toString("base64");asset.optimization={kind:"animated-gif-storage-budget",fps:8,width:240,elapsedMs:performance.now()-start};
  await writeFile(row.runtimePath,JSON.stringify(runtime));
  console.log(JSON.stringify({name:row.name,originalBytes:asset.originalSize,optimizedBytes:asset.size,animationPreserved:true}));
}
