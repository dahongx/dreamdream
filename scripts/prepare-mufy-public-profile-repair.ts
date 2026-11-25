/** Public component DOM only; never reads character prompt or network state. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {routeOpeningContentSplit} from '../src/lib/opening/content';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/22';
const captured=JSON.parse(await readFile(`${dir}/public-profile-frame.json`,'utf8'));
if(captured.sourceUrl!=='https://chat.mufy.ai/chat?roleId=2210a622-c8e3-4e1b-83ba-01422eef5c7c'||captured.roleName!=='江峙'||captured.frame.hiddenInputs!==0||!captured.frame.visibleText.includes('SHIXU ARCHIVE')||!captured.frame.visibleText.includes('TosKa'))throw Error('PUBLIC_FRAME_IDENTITY_MISMATCH');
const baseline=await readFile(`${dir}/opening-ui-before-profile.html`,'utf8');
if(baseline.includes('SHIXU ARCHIVE'))throw Error('ALREADY_HAS_PROFILE');
const dom=new JSDOM(captured.frame.bodyHtml),doc=dom.window.document;
let platformWrappersRemoved=0;
for(const script of doc.querySelectorAll('script'))if(script.textContent?.includes('__MUFY_ARTIFACT_BRIDGE__')){script.remove();platformWrappersRemoved++;}
if(doc.querySelector('iframe,input[type="hidden"]'))throw Error('UNEXPECTED_NESTED_OR_HIDDEN_PAYLOAD');
// HTML parsers move a leading body <style> into the document head. Preserve
// those authored styles as well as the separately captured live head styles.
const styles=[...new Set<string>([...captured.frame.headStyles,...[...doc.head.querySelectorAll('style')].map(node=>node.textContent??'')])];
const source=`<!doctype html><html><head>${styles.map(css=>`<style>${css}</style>`).join('\n')}</head><body>${doc.body.innerHTML}</body></html>`;
if(styles.some(css=>!source.includes(css)))throw Error('PUBLIC_STYLES_LOST');
if(source.includes('__MUFY_ARTIFACT_BRIDGE__'))throw Error('PLATFORM_WRAPPER_REMAINS');
const candidate=baseline+'\n\n```html\n'+source+'\n```\n';
const route=routeOpeningContentSplit(candidate,'public-profile-repair');
if(!route.inline||route.inline.kind==='html'||!(route.inline.kind==='iframe'?[route.inline.srcdoc]:route.inline.srcdocs).some(s=>s.includes('SHIXU ARCHIVE')&&s.includes('TosKa')))throw Error('PROFILE_NOT_ROUTED');
await writeFile(`${dir}/opening-with-public-profile.html`,candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(`${dir}/public-profile-repair-preparation.json`,JSON.stringify({recordedAt:new Date().toISOString(),scope:'Append exactly the missing observed public profile; preserve current opening byte-for-byte as prefix',baselineHash:hash(baseline),candidateHash:hash(candidate),baselineChars:baseline.length,candidateChars:candidate.length,platformWrappersRemoved,remainingAuthorScripts:doc.scripts.length,applied:false,fullFidelityAccepted:false},null,2));
console.log(JSON.stringify({baselineChars:baseline.length,candidateChars:candidate.length,platformWrappersRemoved,liveWrites:0}));dom.window.close();
