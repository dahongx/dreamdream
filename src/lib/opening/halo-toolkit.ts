/** Public toolkit data, never an author program or a parent-window capability. */
export interface HaloToolkitData {
  id: string;
  shellHtml: string;
  css: string;
  tracks: {name: string; src: string}[];
  emojis: {short: string; url: string}[];
  groups: {name: string; items: {label: string; content: string}[]}[];
  bossSites?: Record<string,string[]>;
}
export function validHaloToolkit(value: unknown): value is HaloToolkitData {
  if (!value || typeof value !== 'object') return false;
  const d = value as HaloToolkitData;
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const https = (v: unknown) => { try { return text(v, 2048) && new URL(v as string).protocol === 'https:'; } catch { return false; } };
  return text(d.id, 120) && /^[-\w]+$/.test(d.id) && text(d.shellHtml, 100000) && text(d.css, 100000)
    && Array.isArray(d.tracks) && d.tracks.length > 0 && d.tracks.length <= 30 && d.tracks.every(t => t && text(t.name, 200) && https(t.src))
    && Array.isArray(d.emojis) && d.emojis.length <= 100 && d.emojis.every(e => e && text(e.short, 200) && https(e.url))
    && Array.isArray(d.groups) && d.groups.length <= 20 && d.groups.every(g => g && text(g.name, 200) && Array.isArray(g.items) && g.items.length <= 50 && g.items.every(i => i && text(i.label, 200) && text(i.content, 40000)))
    && (d.bossSites===undefined||(typeof d.bossSites==='object'&&d.bossSites!==null&&Object.entries(d.bossSites).length<=10&&Object.entries(d.bossSites).every(([name,urls])=>text(name,50)&&Array.isArray(urls)&&urls.length>0&&urls.length<=10&&urls.every(https))))
    && JSON.stringify(d).length <= 500000;
}
/** No send hook or hidden conversation access: the host receives only a draft. */
export function haloDraftAppend(current: string, text: string): string {
  return current + (current ? '\n' : '') + text;
}

export type HaloCommandMode = 'prefix'|'suffix'|'inject'|'silence';
export interface HaloCommand {id:string;label:string;content:string;mode:HaloCommandMode}
export interface HaloCommandState {groups:{id:string;name:string;collapsed:boolean;items:HaloCommand[]}[]}
export function defaultHaloCommands(data:HaloToolkitData):HaloCommandState{
 return {groups:data.groups.map((g,i)=>({id:'g'+i,name:g.name,collapsed:false,items:g.items.map((c,j)=>({...c,id:`g${i}c${j}`,mode:'silence'}))}))};
}
export function validHaloCommands(value:unknown):value is HaloCommandState{
 if(!value||typeof value!=='object')return false;const state=value as HaloCommandState;
 if(!Array.isArray(state.groups)||state.groups.length>20)return false;
 const ids=new Set<string>();let total=0,count=0;
 for(const g of state.groups){if(!g||typeof g.id!=='string'||!/^[-\w]{1,128}$/.test(g.id)||ids.has(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>200||typeof g.collapsed!=='boolean'||!Array.isArray(g.items))return false;ids.add(g.id);
  for(const c of g.items){if(!c||typeof c.id!=='string'||!/^[-\w]{1,128}$/.test(c.id)||ids.has(c.id)||typeof c.label!=='string'||!c.label.trim()||c.label.length>200||typeof c.content!=='string'||!c.content.trim()||c.content.length>40000||!['prefix','suffix','inject','silence'].includes(c.mode))return false;ids.add(c.id);total+=c.content.length;count++;}
 }
 return total<=200000&&count<=100;
}
export function readHaloCommands(raw:string|null,data:HaloToolkitData):HaloCommandState{
 try{if(raw&&raw.length<=300000){const value:unknown=JSON.parse(raw);if(validHaloCommands(value))return value;}}catch{/* Own malformed preferences fall back to public defaults. */}
 return defaultHaloCommands(data);
}
/** At the user's explicit send boundary only; draft updates never apply prefixes. */
export function applyHaloCommands(text:string,state:HaloCommandState|null):string{
 if(!state||!text.trim()||!validHaloCommands(state))return text;
 const commands=state.groups.flatMap(g=>g.items),before=commands.filter(c=>c.mode==='prefix').map(c=>c.content),after=commands.filter(c=>c.mode==='suffix').map(c=>c.content);
 return [...before,text,...after].join('\n');
}
export function haloInjectedCommands(state:HaloCommandState):string{
 return state.groups.flatMap(g=>g.items).filter(c=>c.mode==='inject').map(c=>c.content).join('\n');
}
export function applyScopedHaloCommands(text:string,selection:{scope:string;value:HaloCommandState|null}|null,scope:string):string{
 return applyHaloCommands(text,selection?.scope===scope?selection.value:null);
}
