/** Public literal sidebar defaults only. No author program execution. */
import {readFile,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
import {publicVariableDeclaration} from '../src/lib/import/mufy-public-prefix-extractor';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',rank=Number(process.argv[2]??22),sourceIndex=new Map([[22,3],[24,4]]).get(rank);
if(sourceIndex===undefined)throw Error('EXPLICIT_REVIEWED_PUBLIC_MENU_MAPPING_REQUIRED');
const source=JSON.parse(await readFile(root+`/final-acceptance/${rank}/source-public-component-inventory.json`,'utf8'));
const dom=new JSDOM(source.roots[0].frames[sourceIndex].html),doc=dom.window.document;
const scripts=[...doc.querySelectorAll('script'),...[...doc.querySelectorAll('template')].flatMap(t=>[...t.content.querySelectorAll('script')])].map(s=>s.textContent??'').filter(s=>s.includes('const censyData ='));
if(scripts.length!==1)throw Error('PUBLIC_MENU_PROGRAM_REQUIRED');
function literal(n:ts.Node):unknown{if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;if(ts.isArrayLiteralExpression(n))return n.elements.map(literal);if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.map(p=>{if(!ts.isPropertyAssignment(p)||!p.name||(!ts.isIdentifier(p.name)&&!ts.isStringLiteral(p.name)))throw Error('MENU_LITERAL_KEY_REQUIRED');return[p.name.text,literal(p.initializer)];}));throw Error('MENU_STATIC_STRINGS_REQUIRED');}
const init=publicVariableDeclaration(scripts[0],'censyData').initializer;if(!init)throw Error('PUBLIC_MENU_LITERAL_REQUIRED');
const data=literal(init) as {emojis:{short:string;full:string;url:string}[];cmds:{short:string;full:string}[];faqs:string[]};
if(!Array.isArray(data.emojis)||!Array.isArray(data.cmds)||!Array.isArray(data.faqs)||data.emojis.some(x=>new URL(x.url).protocol!=='https:'))throw Error('MENU_PUBLIC_DEFAULTS_INVALID');
await writeFile(root+`/rule-repairs/${rank}/public-menu-defaults.json`,JSON.stringify({rank,observedAt:new Date().toISOString(),sourceIndex,authorProgramExecuted:false,sourceStorageRead:false,data},null,2));dom.window.close();console.log(JSON.stringify({rank,emojis:data.emojis.length,commands:data.cmds.length,faqs:data.faqs.length}));
