/** Contact sheets of actual browser captures; no browser/network access. */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
const dir='outputs/chat-skin-upgrade/full-audit-20261027';
const rows=JSON.parse(await readFile(`${dir}/post-release-evidence.json`,'utf8')) as {index:number;name:string;viewport:string;file:string}[];
const mobile=[...new Map(rows.filter(r=>r.viewport==='mobile').map(r=>[r.index,r])).values()];
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for(let start=0;start<mobile.length;start+=10){
 const tiles=[];
 for(const [i,r] of mobile.slice(start,start+10).entries()){
  const path=`${dir}/${r.file}`,m=await sharp(path).metadata();
  if(m.width!==390||m.height!==844)throw Error('INVALID_CAPTURE: '+r.name);
  const header=await sharp(path).extract({left:0,top:0,width:390,height:72}).toBuffer();
  const footer=await sharp(path).extract({left:0,top:714,width:390,height:130}).toBuffer();
  const label=Buffer.from(`<svg width="390" height="28"><rect width="390" height="28" fill="#fff"/><text x="8" y="20" font-size="15" fill="#111">${r.index+1}. ${escape(r.name)}</text></svg>`);
  const tile=await sharp({create:{width:390,height:232,channels:3,background:'#fff'}}).composite([{input:label,left:0,top:0},{input:header,left:0,top:28},{input:footer,left:0,top:100}]).png().toBuffer();
  tiles.push({input:tile,left:(i%2)*390,top:Math.floor(i/2)*232});
 }
 const out=`${dir}/controls-sheet-${Math.floor(start/10)+1}.png`;
 await sharp({create:{width:780,height:Math.ceil(tiles.length/2)*232,channels:3,background:'#ddd'}}).composite(tiles).png().toFile(out);
 console.log(out);
}
await writeFile(`${dir}/controls-sheet-index.json`,JSON.stringify(mobile.map((r,i)=>({index:r.index,name:r.name,sheet:Math.floor(i/10)+1})),null,2));
