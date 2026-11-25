/** Read only saved public DOM. Parse literal AST, do not evaluate author JS. */
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
import {publicVariableDeclaration} from '../src/lib/import/mufy-public-prefix-extractor';
import {validHaloToolkit, type HaloToolkitData} from '../src/lib/opening/halo-toolkit';
const start=performance.now(), dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/49/native-toolkit';
const raw=await readFile(dir+'/source-public-frame.html','utf8'),dom=new JSDOM(raw),payload=dom.window.document.querySelector<HTMLTemplateElement>('#luludawang-censybaby-toolkit')?.content;
if(!payload)throw Error('EXACT_PUBLIC_TOOLKIT_TEMPLATE_REQUIRED');
const scripts=Array.from(payload.querySelectorAll('script')).map(s=>s.textContent??'').join('\n');
function literal(n:ts.Node):unknown {
 if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
 if(ts.isNumericLiteral(n))return Number(n.text);
 if(n.kind===ts.SyntaxKind.FalseKeyword)return false;if(n.kind===ts.SyntaxKind.TrueKeyword)return true;
 if(ts.isArrayLiteralExpression(n))return n.elements.map(literal);
 if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.map(p=>{if(!ts.isPropertyAssignment(p)||(!ts.isIdentifier(p.name)&&!ts.isStringLiteral(p.name)))throw Error('STATIC_PUBLIC_PROPERTY_REQUIRED');return[p.name.text,literal(p.initializer)];}));
 throw Error('NON_LITERAL_PUBLIC_DATA_REJECTED');
}
const tracks=literal(publicVariableDeclaration(scripts,'fullPlaylist').initializer!) as {name:string;src:string}[];
const emojis=literal(publicVariableDeclaration(scripts,'emojis').initializer!) as {short:string;url:string}[];
const tree=ts.createSourceFile('public-toolkit.js',scripts,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
let defaults:unknown,bossSites:unknown;function visit(n:ts.Node){if(ts.isFunctionDeclaration(n)&&n.name?.text==='drownCmdDefault'){const r=n.body?.statements.find(ts.isReturnStatement);if(r?.expression)defaults=literal(r.expression);}if(ts.isBinaryExpression(n)&&ts.isPropertyAccessExpression(n.left)&&n.left.name.text==='censyBoss_pool'&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken)bossSites=literal(n.right);ts.forEachChild(n,visit);}visit(tree);
const groups=(defaults as {groups:HaloToolkitData['groups'];ungrouped:{label:string;content:string}[]});
if(tracks.length!==24||emojis.length!==17||groups.groups.length!==4)throw Error('PUBLIC_TOOLKIT_DATA_COUNTS_CHANGED');
let css=Array.from(payload.querySelectorAll('style')).map(e=>e.textContent).join('\n');
const clone=payload.cloneNode(true) as DocumentFragment;
clone.querySelectorAll('script,style').forEach(e=>e.remove());
let n=0;const actions=new Set<string>();
for(const el of clone.querySelectorAll('*')){
 for(const attr of Array.from(el.attributes)){
  if(/^on/i.test(attr.name)){
   // Preserve a finite action descriptor as inert data, never source evaluation.
   if(attr.name==='onclick'&&/^window\.parent\.censy\w+\((?:|[12]|'top'|'bottom'|event|null, true)\)$/.test(attr.value)){el.setAttribute('data-halo-action',attr.value.replace('window.parent.',''));actions.add(attr.value);}
   el.removeAttribute(attr.name);
  }
 }
 const inline=el.getAttribute('style');if(inline){const cls='nj_halo49_inline_'+n++;el.classList.add(cls);el.removeAttribute('style');css+='\n.'+cls+'{'+inline+'}';}
}
// The original toolkit is injected into Mufy's page and inherits this public
// computed foreground/font. Keep that inheritance inside the inert shell so
// our platform's text-primary cannot recolor otherwise unstyled source text.
const sourceRoot=dom.window.document.createElement('div');sourceRoot.className='nj_halo49_source_root';sourceRoot.appendChild(clone);
css+='\n.nj_halo49_source_root{color:rgb(249,250,251);font-family:ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";font-size:16px;line-height:1.5}';
const wrapper=dom.window.document.createElement('div');wrapper.appendChild(sourceRoot);
const data:HaloToolkitData={id:'linxu-halo-v42',shellHtml:wrapper.innerHTML,css,tracks:tracks.map(t=>({...t,src:t.src.replace(/^http:/,'https:')})),emojis:emojis.map(({short,url})=>({short,url})),groups:[...groups.groups.map(g=>({name:g.name,items:g.items.map(({label,content})=>({label,content}))})),{name:'未分组',items:groups.ungrouped.map(({label,content})=>({label,content}))}],bossSites:bossSites as Record<string,string[]>};
if(!validHaloToolkit(data))throw Error('SAFE_TOOLKIT_DATA_INVALID');
await writeFile(dir+'/toolkit-data.json',JSON.stringify(data,null,2));
const proof={observedAt:new Date().toISOString(),elapsedMs:performance.now()-start,sourceSha256:createHash('sha256').update(raw).digest('hex'),tracks:data.tracks.length,emojis:data.emojis.length,commands:data.groups.reduce((n,g)=>n+g.items.length,0),inertActions:[...actions],inlineStyles:n,authorProgramExecuted:false,sourceStorageRead:false,ownerUiSaved:false,buildStarted:false,fullFidelityAccepted:false,pending:['native controller interaction QA','drawing and prefix/suffix contract','owner UI baseline and TEST verification']};
await writeFile(dir+'/data-proof.json',JSON.stringify(proof,null,2));dom.window.close();console.log(JSON.stringify(proof));
