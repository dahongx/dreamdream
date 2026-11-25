import {test,expect} from 'bun:test';
import {compositionEvidenceIssues} from '../mufy-candidate-composition-ui-check.mjs';
const entry={rank:21,name:'Public fixture',sha256:'hash',native:[{variant:'page-controls'}],prefixes:[]};
const proof={rank:21,identity:'21 · Public fixture',candidateSha256:'hash',native:[{variant:'page-controls',count:1}],prefixCount:0,expectedPrefixes:0,frames:[{title:'original-frame'}],framesAfterRepaint:[{title:'original-frame'}],repaintCount:'1',sendCount:'0',hostGeometry:{viewport:390,width:375,scrollWidth:375}};
test('only matching explicit UI observations satisfy the narrow composition gate',()=>{expect(compositionEvidenceIssues(entry,proof,'mobile')).toEqual([]);});
test('matching iframe counts do not hide removed/replaced slots or stale candidates',()=>{expect(compositionEvidenceIssues(entry,{...proof,candidateSha256:'old',framesAfterRepaint:[{title:'different-frame'}]},'mobile')).toEqual(['identity-or-candidate-fingerprint','iframe-slot-change']);});
test('native omission, duplicate prefix, wrong viewport and sends fail independently',()=>{expect(compositionEvidenceIssues(entry,{...proof,native:[],prefixCount:1,sendCount:'1',hostGeometry:{viewport:1700,width:375,scrollWidth:410}},'mobile')).toEqual(['native-mount-count','prefix-mount-count','repaint-or-send-count','host-overflow','mobile-viewport']);});
