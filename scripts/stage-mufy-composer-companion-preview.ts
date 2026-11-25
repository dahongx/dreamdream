/** Public UI script only; never bundle a full role package into a preview. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractMufyComposerCompanion} from '../src/lib/import/mufy-composer-companion';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const receipts=JSON.parse(await readFile(root+'/normal-ui-import-receipts.json','utf8'));
const receipt=receipts.rows.find((row:{rank:number})=>row.rank===24);
const prepared=JSON.parse(await readFile(root+'/prepared/'+receipt.sourceKey+'/prepared.json','utf8'));
const program=extractMufyComposerCompanion(prepared.beautification.openingComponent);
if(!program)throw Error('KNOWN_PUBLIC_COMPANION_NOT_FOUND');
const output=root+'/rule-repairs/24/composer-companion';
await mkdir(output,{recursive:true});
await writeFile(output+'/source-program.json',JSON.stringify({content:'<script>'+program+'</script>',sourceUrl:receipt.sourceUrl,publicUiOnly:true,programSha256:createHash('sha256').update(program).digest('hex')},null,2));
console.log(JSON.stringify({rank:24,programCharacters:program.length,publicUiOnly:true,databaseAccess:false}));
