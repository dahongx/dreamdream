/** Read-only 8091 source baseline; prepare only this repair, never build/deploy. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-identity-controls-20261103',root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const paths=['src/components/chat/ChatRoom.tsx','src/components/chat/MufySourceControls.tsx','src/components/regex/RegexIframe.tsx','src/lib/import/mufy-component-presentation.ts','src/components/chat/MufyNativeImageSidebar.tsx','src/lib/regex/iframe-bridge.ts'];
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
async function remote(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw Error(`READ_ONLY_TEST_FAILED:${err.slice(0,120)}`);return out;}
function replaceOnce(text:string,before:string,after:string){if(text.split(before).length!==2)throw Error('REPAIR_BOUNDARY_NOT_UNIQUE:'+before.slice(0,70));return text.replace(before,()=>after);}
if((await remote('cd /root/projects/yearn-chat && docker compose port app 3000')).trim()!=='0.0.0.0:8091')throw Error('WRONG_TEST_TARGET');
const image=(await remote("docker inspect $(docker ps --filter publish=8091 --no-trunc --format '{{.ID}}') --format '{{.Image}}'")).trim();
if(!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('INVALID_TEST_IMAGE');
const entries=[],staged:{path:string;before:string|null;after:string}[]=[];
for(const path of paths){
 const before=await remote(`cd /root/projects/yearn-chat && cat '${path}'`);let after=before;
 if(path.endsWith('/ChatRoom.tsx')){
  const at="import {MufySourceControls,uniqueSourceControls} from '@/components/chat/MufySourceControls';";
  after=replaceOnce(after,at,at+"\nimport {ChatInputToolbar} from '@/components/chat/ChatInputToolbar';\nimport {appendComposerDraft,type ComposerFillOptions} from '@/lib/opening/composer-fill';");
  after=replaceOnce(after,'<div className="mx-auto mb-[var(--space-sm)] flex w-full max-w-[640px] items-center justify-start gap-[var(--space-sm)]">','<ChatInputToolbar wrap={!!sourceControls}>');
  const control='{sourceControls&&<MufySourceControls key={sessionId+sourceControls.pageControls?.id} spec={sourceControls} inputRef={inputBoxRef} onChange={setInput}/>}';
  after=replaceOnce(after,'      '+control+'\n','');
  after=replaceOnce(after,'          disabled={submitting}\n        />\n      </div>\n      {/* #nj_chat_input_box','          disabled={submitting}\n        />\n        '+control+'\n      </ChatInputToolbar>\n      {/* #nj_chat_input_box');
  after=replaceOnce(after,'const onHostFillComposer = useCallback((text: string) => {','const onHostFillComposer = useCallback((text: string, options?:ComposerFillOptions) => {');
  after=replaceOnce(after,'    setInput((prev) => {\n      const sep = prev && !prev.endsWith("\\n") ? "\\n" : "";\n      return prev + sep + text;\n    });','    setInput((prev) => appendComposerDraft(prev,text,options));');
 }
 if(path.endsWith('/MufySourceControls.tsx'))after=replaceOnce(after,"{display:'flex',justifyContent:'flex-end',maxWidth:640,margin:'0 auto 4px',width:'100%'}","{display:'flex',justifyContent:'flex-end',flexShrink:0,marginInlineStart:'auto',paddingInlineEnd:10,width:'max-content',maxWidth:'100%',boxSizing:'border-box'}");
 if(path.endsWith('/RegexIframe.tsx')){
  if(before.includes('sandbox="allow-scripts allow-same-origin"'))throw Error('UNEXPECTED_UNREVIEWED_SECURITY_BASELINE');
  after=replaceOnce(after,'[ctxHistoryRef, locale,officialVideoUrl]','[ctxHistoryRef, locale,officialVideoUrl,userName]');
  const at='import { iframeProgramKey } from "@/lib/regex/iframe-incremental";';
  after=replaceOnce(after,at,at+"\nimport type {ComposerFillOptions} from '@/lib/opening/composer-fill';");
  after=replaceOnce(after,'onFillComposer?: (text: string) => void;','onFillComposer?: (text: string,options?:ComposerFillOptions) => void;');
  after=replaceOnce(after,'latest.onFillComposer?.(text);',"latest.onFillComposer?.(text,args?.separator==='none'?{separator:'none'}:undefined);");
 }
 if(path.endsWith('/mufy-component-presentation.ts')){
  after="import {mufyPlayerNameBinding} from './mufy-player-name';\n"+after;
  after=replaceOnce(after,"return '<style data-mufy-component-presentation>body{color:rgb(0,0,0);text-shadow:none}</style>\\n' + srcdoc;","return '<style data-mufy-component-presentation>body{color:rgb(0,0,0);text-shadow:none}</style>\\n' + mufyPlayerNameBinding(srcdoc) + srcdoc;");
 }
 if(path.endsWith('/MufyNativeImageSidebar.tsx')){
  const at="import {hasPublicHubCommandCopy} from '@/lib/regex/iframe-bridge';";
  after=replaceOnce(after,at,at+"\nimport {insMusicTriggerTop,insMusicDocumentPresentation} from '@/lib/opening/native-ins-presentation';\nimport type {ComposerFillOptions} from '@/lib/opening/composer-fill';\nimport {nativePlayerDocumentPresentation} from '@/lib/opening/native-player-presentation';");
  after=replaceOnce(after,'onFillComposer?: (text: string) => void;','onFillComposer?: (text: string,options?:ComposerFillOptions) => void;');
  after=replaceOnce(after,'height:380px;margin-top:8px;pointer-events:auto','height:380px;margin-top:0;margin-right:10px;pointer-events:auto');
  after=replaceOnce(after,'      data-nj-native-image-sidebar\n',"      data-nj-native-image-sidebar\n      style={isInsMusic?{top:insMusicTriggerTop(spec.css)}:undefined}\n");
  after=replaceOnce(after,'srcdoc={mufyFixedCanvasBoundary(srcdoc,true)+srcdoc}','srcdoc={mufyFixedCanvasBoundary(srcdoc,true)+(isInsMusic?insMusicDocumentPresentation(srcdoc):nativePlayerDocumentPresentation(srcdoc))}');
 }
 if(path.endsWith('/iframe-bridge.ts'))after=replaceOnce(after,"fillComposer: function(text) { return call('fillComposer', { text }); },","fillComposer: function(text, options) { return call('fillComposer', options && options.separator === 'none' ? { text, separator: 'none' } : { text }); },");
 staged.push({path,before,after});
 entries.push({path,before:hash(before),after:hash(after),newFile:false});
}
for(const path of ['src/components/chat/ChatInputToolbar.tsx','src/lib/import/mufy-player-name.ts','src/lib/opening/composer-fill.ts','src/lib/opening/native-ins-presentation.ts','src/lib/opening/native-player-presentation.ts']){
 if((await remote(`cd /root/projects/yearn-chat && if test -e '${path}'; then printf EXISTS; else printf MISSING; fi`)).trim()!=='MISSING')throw Error('NEW_FILE_EXISTS');
 const text=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');staged.push({path,before:null,after:text});entries.push({path,before:null,after:hash(text),newFile:true});
}
const finalImage=(await remote("docker inspect $(docker ps --filter publish=8091 --no-trunc --format '{{.ID}}') --format '{{.Image}}'")).trim();if(image!==finalImage)throw Error('TEST_CHANGED_DURING_BASELINE');
for(const item of staged){for(const[kind,text]of [['baseline',item.before],['patch',item.after]] as const){if(text===null)continue;const out=`${dir}/${kind}/${item.path}`;await mkdir(dirname(out),{recursive:true});await writeFile(out,text);}}
const manifest={observedAt:new Date().toISOString(),basedOnImage:image,target:'115.29.213.73:8091',entries,remoteWrites:0,buildStarted:false,deployed:false,databaseTouched:false,excluded:['Bilibili sandbox same-origin expansion','clipboard candidate','unrelated model status changes'],pending:'Whole-batch acceptance before build; actual TEST validation after future reviewed release'};
await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt:manifest.observedAt,kind:'identity-controls-readonly-baseline-and-prepare-wall',elapsedMs:performance.now()-tick,agentNetMs:null,buildStarted:false,remoteWrites:0})+'\n');
console.log(JSON.stringify(manifest));
