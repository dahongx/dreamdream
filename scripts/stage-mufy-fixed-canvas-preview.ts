/** Reconstruct public CSS/markup plus the three already-visible modal handlers only. */
import {JSDOM} from 'jsdom';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const fixtures=[];
for(const [rank,index,selector] of [[49,3,'.cen-archive-desk'],[49,11,'.ct-status-board-clear'],[21,6,'.censy-multi-wrap'],[21,5,'.cen_k_mag_wrap']] as const){
 const inventory=await Bun.file(root+`/final-acceptance/${rank}/source-public-component-inventory.json`).json();
 const dom=new JSDOM(inventory.roots[0].frames[index].html),d=dom.window.document,shell=d.querySelector(selector);if(!shell)throw Error('KNOWN_PUBLIC_FIXED_CANVAS_REQUIRED');
 const css=Array.from(d.querySelectorAll('style')).map(e=>e.textContent??'').join('\n');
 const scripts=index===11?Array.from(d.querySelectorAll('script')).map(e=>e.textContent??'').filter(s=>s.includes('function openCtModal')):[];
 if(index===11&&(scripts.length!==1||/parent\.|localStorage|sessionStorage|credentials|fetch\(|__MUFY_/i.test(scripts[0])))throw Error('ONLY_PUBLIC_LOCAL_MODAL_PROGRAM_ALLOWED');
 const modal=d.getElementById('ctModal');
 fixtures.push({rank,index,selector,html:'<html><head><style data-mufy-adaptation="mobile-box-model"></style><style>'+css+'</style></head><body>'+shell.outerHTML+(modal&&!shell.contains(modal)?modal.outerHTML:'')+scripts.map(s=>'<script>'+s+'</script>').join('')+'</body></html>'});dom.window.close();
}
const relationship=fixtures.find(f=>f.rank===21)!;
fixtures.push({...relationship,html:relationship.html.replace('</head>','<style data-test-author-override>html{overflow:visible}</style></head>')});
await Bun.write(root+'/final-acceptance/49/local-fixtures/fixed-canvas-preview.json',JSON.stringify(fixtures));console.log(JSON.stringify({publicCanvases:4,authorCascadeControlFixture:1,platformBootstrapRemoved:true,TESTDeployed:false}));
