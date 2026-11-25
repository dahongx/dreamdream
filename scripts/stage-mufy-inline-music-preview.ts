/** Only the public rank-26 music frame; never the private role package. */
import {mkdir,writeFile} from 'node:fs/promises';
import {normalizePublicFrameReplay} from '../src/lib/import/mufy-public-frame-replay';
import {needsMufyInlineParentShim} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const source=await Bun.file(`${root}/final-acceptance/26/source-public-component-inventory.json`).json();
if(source.rank!==26||!source.roleNamePresent)throw Error('WRONG_MUSIC_SOURCE');
const html=normalizePublicFrameReplay(source.roots[0].frames[1].html).html;
if(!needsMufyInlineParentShim(html,true))throw Error('OBSERVED_PLAYER_SIGNATURE_MISSING');
const content=html+'<style data-mufy-adaptation="mobile-box-model"></style>';
const dir=`${root}/rule-repairs/26/inline-music`;await mkdir(dir,{recursive:true});
await writeFile(`${dir}/source-program.json`,JSON.stringify({content,sourceUrl:source.url,observedAt:source.observedAt,publicUiOnly:true},null,2));
console.log(JSON.stringify({rank:26,publicFrame:1,characters:content.length,remoteWrites:0}));
