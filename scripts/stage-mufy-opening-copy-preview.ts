/** Public expanded opening only; no author parent injector or private role fields. */
import {readFile,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {hasPublicEngravedOpening} from '../src/lib/regex/iframe-bridge';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/38';
const source=JSON.parse(await readFile(root+'/source-public-component-inventory.json','utf8')),dom=new JSDOM(source.roots[0].frames[6].html),doc=dom.window.document,shell=doc.querySelector('.mufy-glass-openings');
if(!shell||!hasPublicEngravedOpening(shell.outerHTML))throw Error('KNOWN_PUBLIC_OPENING_REQUIRED');
const css=[...doc.querySelectorAll('style')].map(x=>x.textContent??'').join('\n');
const html='<html><head><style>'+css+'</style></head><body>'+shell.outerHTML+'</body></html>';
await writeFile(root+'/opening-copy-frame-20261031.json',JSON.stringify({rank:38,sourceIndex:6,html,scope:'public opening/button only, no parent injector'},null,2));dom.window.close();console.log(JSON.stringify({rank:38,characters:html.length,publicSourceOnly:true}));
