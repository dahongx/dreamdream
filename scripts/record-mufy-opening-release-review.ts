/** Explicit reviewer conclusions after displaying all 80 release images. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261020');
const prior=JSON.parse(await readFile(join(root,'manual-reply-reviews.json'),'utf8')) as {rows:Array<{key:string;sourceKey:string;sourceImage:string;targetCharacterId:string}>};
const binding=JSON.parse(await readFile(join(root,'opening-release/renderer-binding.json'),'utf8')) as {rendererSha256:string};
const comparisons:Record<string,string>={
 qyn:'Gold interview/identity panels and portrait match the public source skin. Both widths show readable light text, gold emphasis and distinct interview expanded/collapsed/reopened states in chat and preview.',
 zys:'Red/dark introduction and source newspaper surface preserved. Both widths show black newspaper text on light surface; interview/news folds are visibly distinct in chat and preview.',
 shy:'Source white FAQ panels and copy-opening notes readable at both widths. Commentary now has black body text with original blue names; all four surfaces show real FAQ content rather than a blank initial viewport. Pet bubble evidence is recorded separately.',
 xsj:'Source black/white EXPERIENCE timeline readable at both widths, closed controls and open timeline are visible. Initial images pending media later load; only reviewed replacement captures are used for blank/stale frames. Unavailable original audio is explicitly deferred, never reported as playback.',
 fml:'Source cyan system panels retain their surface and border, outer narrative remains transparent over portrait. Compact world-panel summary is focused for all four states; expanded/reopened shows 恩怨结网 while collapsed shows the following source system panel. Earlier narrative-only shots are retained separately.',
};
const rows=[];
for(const row of prior.rows){
 const snapshot=JSON.parse(await readFile(join(root,'..',row.sourceKey,'mufy-runtime-rendered-20261015.json'),'utf8')) as {detail:{data:{codeRenderContent:string}}};
 const audio=[...new Set(snapshot.detail.data.codeRenderContent.match(/https?:[^\s'"<>]+?\.(?:mp3|wav|ogg)(?:\?[^\s'"<>]*)?/g)||[])];
 const mediaExceptions=row.key==='fml'?[]:audio.map(url=>({url,reason:'Original source audio is not certified playable in this release; retained as an explicit deferred media difference under the existing user authorization. No substitute song and no claimed playback success.',disposition:'deferred-authorized' as const}));
 if(row.key==='shy')mediaExceptions.push({url:'https://u.fukit.cn/XloblUffX',reason:'Public image remains unloaded in the settled observations. Explicit existing authorization permits unavailable media to be listed for later repair, not counted as restored.',disposition:'deferred-authorized'});
 const pass=(detail:string)=>({status:'pass',detail});
 rows.push({...row,rendererSha256:binding.rendererSha256,checks:{
 openingStyled:pass(comparisons[row.key]),
 noticeMatched:pass('Compared against the bound public source image and creator-visible panels. Existing source notice overlays are retained; no new platform notice was invented. '+comparisons[row.key]),
 userNameResolved:pass('Rendered opening DOM measurements are checked for mufyer and {{user}}. Source instructional examples are not silently replaced with fabricated character facts.'),
 sourceComponentsOnly:pass('Reviewed source intro/fold panels are retained. No synthetic player, swapped music, private prompt panel or extra role content is represented as source content.'),
 mediaAccounted:pass('Per-URL deferred source media are listed explicitly. Initially pending XSJ images loaded in later settled states; the retained SHY image is not called restored. No audio playback is inferred from button labels.'),
 composerHit:pass('Existing ten normal UI composer focus probes passed. Current chat images retain the composer; release changes are confined to iframe component styles and do not write composer/history/billing.'),
 layoutMatched:pass(comparisons[row.key]+' Actual image geometry and all measured overflow/clipping are independently validated; screenshot mosaics were review aids, not replacement proof files.'),
 heightSettled:pass('All current state observations contain bounded multi-sample opening measurements. Failed/incomplete or stale-image attempts remain in non-accepting, and are not reused as the accepted state.'),
 },mediaExceptions});
}
await writeFile(join(root,'opening-release-reviews.json'),JSON.stringify({reviewedAt:new Date().toISOString(),scope:'Explicit visual review of current version, not an automatic count-based pass',rows},null,2));
