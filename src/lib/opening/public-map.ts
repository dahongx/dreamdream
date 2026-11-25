/** Inert extraction of the observed four-node public map, never eval author code. */
export type PublicMap={document:string;css:string;name:string;avatar:string;messages:string[][]};
export function parsePublicMap(document:string):PublicMap|null{
 if(document.length>60000||!document.includes('class="map-art-board"')||!document.includes('triggerGlobalNotificationQueue')||!document.includes("'map-toast-container'"))return null;
 const nodes=[...document.matchAll(/onclick=["']window\.triggerMapNodeMsg\((\d)\)["']/g)];
 if(nodes.length!==4||nodes.some((m,i)=>Number(m[1])!==i))return null;
 const data=/const nodeMessages\s*=\s*\[([\s\S]*?)\];/.exec(document)?.[1];
 const groups=data?[...data.matchAll(/msgs\s*:\s*\[([\s\S]*?)\]/g)]:[];
 if(groups.length!==4)return null;
 const messages=groups.map(group=>{
  // This measured program uses simple single-quoted text only. Reject changed
  // syntax instead of guessing a JavaScript decoder or executing it.
  const cleaned=group[1].replace(/\/\/[^\n]*/g,'').trim();
  const values=[...cleaned.matchAll(/'([^'\\\r\n<>]{1,120})'/g)];
  return values.length===4&&cleaned.replace(/'([^'\\\r\n<>]{1,120})'/g,'').replace(/[\s,]/g,'')===''?values.map(m=>m[1]):[];
 });
 const name=/const globalName\s*=\s*'([^'\\<>]{1,128})'/.exec(document)?.[1];
 const avatar=/const globalAvatar\s*=\s*'(https:\/\/cdn\.mufy\.ai\/images\/[a-zA-Z0-9/-]+)'/.exec(document)?.[1];
 const css=[...document.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
 if(!name||!avatar||messages.some(g=>g.length!==4)||!css.includes('.map-node')||!css.includes('.map-art-board'))return null;
 return{document,css,name,avatar,messages};
}
