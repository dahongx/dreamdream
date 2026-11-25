export interface ComposerFillOptions {separator?:'none'}

/** Default host behavior stays newline-separated; source inline append is explicit. */
export function appendComposerDraft(previous:string,text:string,options?:ComposerFillOptions):string{
 if(!text)return previous;
 const separator=options?.separator==='none'?'':previous&&!previous.endsWith('\n')?'\n':'';
 return previous+separator+text;
}
