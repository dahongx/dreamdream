import {SOURCE83_TEMPLATE,SOURCE83_RAW_TEMPLATE,SOURCE83_DRAG_CONTROLLER} from './lin-toolkit-83-binding';
import {LIN_PUBLIC_DATA,validLinToolkitControl} from './lin-toolkit-83';
export function routeLin83PublicProgram(source:string){
 if(source.length>250000)return null;
 const templates=[...source.matchAll(/<template\b[^>]*id=["']luludawang-lin-toolkit["'][^>]*>([\s\S]*?)<\/template>/gi)];
 if(templates.length!==1)return null;
 const normalize=(s:string)=>s.replace(/\r\n/g,'\n');
 const freshRawInner=SOURCE83_RAW_TEMPLATE.replace(/^<template\b[^>]*>/i,'').replace(/<\/template>$/i,'');
 const body=normalize(templates[0][1]);
 if(body!==normalize(SOURCE83_TEMPLATE)&&body!==normalize(freshRawInner))return null;
 if(normalize(source).split(normalize(SOURCE83_DRAG_CONTROLLER)).length!==2)return null;
 const control={presentation:'lin-toolkit-83-v1' as const,sourceTemplateSha256:LIN_PUBLIC_DATA.sourceTemplateSha256,sourceControllerSha256:LIN_PUBLIC_DATA.sourceControllerSha256,sourceDragControllerSha256:LIN_PUBLIC_DATA.sourceDragControllerSha256};
 if(!validLinToolkitControl(control))return null;
 // An inert, explicit output descriptor. Existing runtime must not be handed this before integration.
 return {version:1 as const,variant:'page-controls' as const,shellHtml:LIN_PUBLIC_DATA.shellHtml,css:LIN_PUBLIC_DATA.css,pageControls:{id:LIN_PUBLIC_DATA.id,quickCss:'',scrollButtons:false as const,linToolkit:control},documents:[]};
}
export type Lin83Spec=NonNullable<ReturnType<typeof routeLin83PublicProgram>>;
export function validLin83Spec(value:unknown):value is Lin83Spec{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const s=value as Record<string,unknown>;
 if(Object.keys(s).sort().join()!=='css,documents,pageControls,shellHtml,variant,version'||s.version!==1||s.variant!=='page-controls'||s.shellHtml!==LIN_PUBLIC_DATA.shellHtml||s.css!==LIN_PUBLIC_DATA.css||!Array.isArray(s.documents)||s.documents.length!==0)return false;
 const pc=s.pageControls;if(!pc||typeof pc!=='object'||Array.isArray(pc))return false;const p=pc as Record<string,unknown>;
 return Object.keys(p).sort().join()==='id,linToolkit,quickCss,scrollButtons'&&p.id===LIN_PUBLIC_DATA.id&&p.quickCss===''&&p.scrollButtons===false&&validLinToolkitControl(p.linToolkit);
}
export function lin83Envelope(spec:Lin83Spec):string{
 if(!validLin83Spec(spec))throw Error('UNKNOWN_LIN83_SPEC');
 return `<template data-nj-native-image-sidebar-v1>${JSON.stringify(spec).replace(/</g,'\\u003c')}</template>`;
}
export function parseLin83Envelope(raw:string):Lin83Spec|null{
 if(raw.length>250000)return null;const m=/^<template data-nj-native-image-sidebar-v1>([\s\S]*)<\/template>$/.exec(raw);if(!m)return null;
 try{const spec:unknown=JSON.parse(m[1]);return validLin83Spec(spec)?spec:null}catch{return null}
}
