import {LIN_PUBLIC_DATA} from './lin-83-public-data';
export {LIN_PUBLIC_DATA};
export interface LinToolkitControl {presentation:'lin-toolkit-83-v1';sourceTemplateSha256:string;sourceControllerSha256:string;sourceDragControllerSha256:string}
export function validLinToolkitControl(value:unknown):value is LinToolkitControl{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const s=value as LinToolkitControl;
 return Object.keys(s).sort().join()==='presentation,sourceControllerSha256,sourceDragControllerSha256,sourceTemplateSha256'&&s.presentation==='lin-toolkit-83-v1'&&s.sourceTemplateSha256===LIN_PUBLIC_DATA.sourceTemplateSha256&&s.sourceControllerSha256===LIN_PUBLIC_DATA.sourceControllerSha256&&s.sourceDragControllerSha256===LIN_PUBLIC_DATA.sourceDragControllerSha256;
}
/** Only exact known public command templates receive player placeholders; custom input is never remapped. */
export function bindLinCommandTemplate(template:string,userName:string,characterName:string):string{
 const known=LIN_PUBLIC_DATA.fields.some(f=>f.options.some(o=>o.value===template))||LIN_PUBLIC_DATA.groups.some(g=>g.cmds.some(c=>c===template));
 if(!known)return template;
 return template.replace(/mufyer|\{\{char\}\}/g,token=>token==='mufyer'?(userName.trim()?userName:'mufyer'):(characterName.trim()?characterName:'{{char}}'));
}
export function generateLinConfiguration(values:readonly string[],custom:string,userName:string,characterName:string):string|null{
 if(values.length!==4||typeof custom!=='string'||custom.length>100000||values.some((v,i)=>!LIN_PUBLIC_DATA.fields[i].options.some(o=>o.value===v)))return null;
 const joined=values.map(v=>bindLinCommandTemplate(v,userName,characterName)).filter(Boolean).join('\\n');
 return joined+(custom.trim()?'\\n'+custom:'');
}
/** Actual source UI117 is inserted-block end; its full resulting draft is119, preserving suffix乙丙. */
export function insertLinCommand(value:string,start:number,end:number,text:string):{value:string;caret:number}{
 const at=Number.isFinite(start)?Math.max(0,Math.min(value.length,start)):value.length,until=Number.isFinite(end)?Math.max(at,Math.min(value.length,end)):at;
 const next=value.slice(0,at)+text+value.slice(until);return {value:next,caret:at+text.length};
}
