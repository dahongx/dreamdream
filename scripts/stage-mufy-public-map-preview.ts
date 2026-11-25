/** Generated public-only fixture, no server/owner writes. */
import {parsePublicMap} from '../src/lib/opening/public-map';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const inventory=await Bun.file(root+'/final-acceptance/49/source-public-component-inventory.json').json();
const document=inventory.roots[0].frames[8].html,spec=parsePublicMap(document);
if(!spec)throw Error('EXACT_PUBLIC_MAP_REQUIRED');
await Bun.write(root+'/final-acceptance/49/local-fixtures/public-map-preview.json',JSON.stringify(spec));
console.log(JSON.stringify({rank:49,nodes:4,messages:16,authorProgramExecuted:false,TESTDeployed:false}));
