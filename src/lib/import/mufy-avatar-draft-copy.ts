/** Historical audit compatibility only. New cards must preserve clipboard actions. */
import {JSDOM} from 'jsdom';
const SOURCE="navigator.clipboard.writeText(this.src);alert('Image Link Copied!')";
const TARGET="window.host.fillComposer(this.src);alert('已填入草稿，请确认后发送。')";
export function adaptMufyAvatarDraftCopy(input:string,options:{historicalAuditOnly?:boolean}={}):{html:string;adapted:number}{
 const occurrences=input.split(SOURCE).length-1;
 if(!occurrences)return{html:input,adapted:0};
 if(!options.historicalAuditOnly)throw Error('AVATAR_CLIPBOARD_SEMANTICS_MUST_BE_PRESERVED');
 const dom=new JSDOM(input),images=[...dom.window.document.querySelectorAll('img[onclick]')].filter(e=>e.getAttribute('onclick')===SOURCE);
 const valid=images.length===occurrences&&images.every(e=>{const src=e.getAttribute('src');return !!src&&/^https?:\/\//.test(src);});dom.window.close();
 if(!valid)throw Error('PUBLIC_AVATAR_COPY_BOUNDARY_CHANGED');
 return{html:input.replaceAll(SOURCE,TARGET),adapted:occurrences};
}
