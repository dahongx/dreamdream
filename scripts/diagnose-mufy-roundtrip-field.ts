/** Inspect local XML field fidelity without printing prompt contents. */
import {readFile} from 'node:fs/promises';
import {parseExternalCharacterXml} from '../src/lib/import/external-card';
import {adaptMufyCompletionContract} from '../src/lib/import/mufy-completion-contract';
const path='logs/mufy-profiles/full-20261013/next-batch-30-20261028/prepared/char_c83350f3e873da316438/prepared.json';
const prepared=JSON.parse(await readFile(path,'utf8'));
const expected=adaptMufyCompletionContract(prepared.character.outputSetting??'');
const field=(n:string,v:string)=>`<${n}><![CDATA[${v.replaceAll(']]>',']]]]><![CDATA[>').replaceAll('\r',']]>&#13;<![CDATA[')}]]></${n}>`;
const parsed=parseExternalCharacterXml(`<mufy-character><元信息>${field('名称',prepared.character.name)}</元信息>${field('人设','diagnostic-placeholder')}${field('输出设定',expected)}</mufy-character>`);
if(!parsed.ok)throw Error('PARSE_FAILED');
const actual=parsed.value.character.outputSetting??'';
let index=0;while(index<Math.min(expected.length,actual.length)&&expected[index]===actual[index])index++;
console.log(JSON.stringify({expectedLength:expected.length,actualLength:actual.length,firstDifference:index,expectedCodes:Array.from(expected.slice(Math.max(0,index-3),index+5)).map(c=>c.charCodeAt(0)),actualCodes:Array.from(actual.slice(Math.max(0,index-3),index+5)).map(c=>c.charCodeAt(0)),expectedCr:(expected.match(/\r/g)||[]).length,actualCr:(actual.match(/\r/g)||[]).length,trimEqual:expected.trim()===actual.trim(),lineEndingEqual:expected.replace(/\r\n?/g,'\n')===actual},null,2));
