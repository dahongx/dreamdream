import {readFile,writeFile} from 'node:fs/promises';
const base='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const before=await readFile(base+'/chengfeng-opening-before-sidebar-repair.html','utf8');
if(!before.startsWith('<details class="world-sidebar">'))throw Error('Unexpected component boundary');
const end=before.indexOf('</details>')+'</details>'.length;
const sidebar=before.slice(0,end),rest=before.slice(end);
if((sidebar.match(/<details\b/g)||[]).length!==1||(sidebar.match(/<img\b/g)||[]).length!==134)throw Error('Sidebar shape changed');
// The host owns viewport fixation. Inner coordinates must be relative to that
// fixed canvas, not retain the source document's viewport transforms.
const layout='<style data-mufy-adaptation="world-sidebar-canvas">.world-sidebar{position:relative!important;top:0!important;right:auto!important;transform:none!important;width:100%!important;height:100vh!important}.world-sidebar>.sidebar-trigger{position:absolute!important;right:0!important;top:50%!important;transform:translateY(-50%)!important}.world-sidebar>.sidebar-content{position:absolute!important;right:48px!important;top:50%!important;transform:translateY(-50%)!important;margin:0!important;width:230px!important;max-height:calc(100vh - 24px)!important;box-sizing:border-box!important}</style>';
const after='<floating kind="details-right" pos="right-center" interactive="true">'+sidebar+layout+'</floating>'+rest;
if(after.slice(after.indexOf('</floating>')+11)!==rest)throw Error('Unrelated component content changed');
await writeFile(base+'/chengfeng-opening-after-sidebar-repair.html',after);
console.log(JSON.stringify({before:before.length,after:after.length,images:134,unchangedRemainder:true}));
