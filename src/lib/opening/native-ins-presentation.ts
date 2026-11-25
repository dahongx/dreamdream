/** Preserve the position declared by the inert source wrapper, never arbitrary CSS. */
export function insMusicTriggerTop(css:string):string|undefined{
 const clean=css.replace(/\/\*[\s\S]*?\*\//g,''),block=/\.ins-music-sidebar\s*\{([^}]*)\}/.exec(clean)?.[1];
 if(!block)return;
 const values=[...block.matchAll(/(?:^|;)\s*top\s*:\s*([^;]+)/g)],last=values.at(-1)?.[1].trim().replace(/\s*!important\s*$/,'');
 if(!last)return;
 const value=/^(\d+(?:\.\d+)?)(px|vh|%)$/.exec(last);
 if(!value||Number(value[1])>(value[2]==='px'?2000:100))return;
 return last;
}

/** Opaque source buttons need the typography reset their original host supplied. */
export function insMusicDocumentPresentation(srcdoc:string):string{
 const content=srcdoc.includes('insWrite_cen = function(str, el)')?srcdoc.replace('window.host.fillComposer(str);','window.host.fillComposer(str,{separator:"none"});'):srcdoc;
 if(content.includes('data-nj-ins-control-defaults'))return content;
 return '<style data-nj-ins-control-defaults>#ins-wrapper-cen{line-height:1.5}#ins-wrapper-cen button{font-family:inherit;line-height:inherit}</style>'+content;
}
