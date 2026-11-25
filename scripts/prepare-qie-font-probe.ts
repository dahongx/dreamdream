import postcss from 'postcss';
const root = 'logs/mufy-profiles/full-20261013/next-batch-10-20261023/strict-acceptance-20261024';
const evidence = await Bun.file(`${root}/qie-font-dom-evidence.json`).json();
const rules: string[] = [];
postcss.parse(evidence.sourceCss).walkAtRules('font-face', rule => {
  if (rule.toString().includes('CensyCustomTitleFont')) rules.push(rule.toString());
});
if (!rules.length) throw Error('ORIGINAL_FONT_DECLARATION_MISSING');
const face = [...new Set(rules)].join('\n');
if (/<\/style/i.test(face)) throw Error('INVALID_STYLE_BOUNDARY');
// Isolated diagnostic only, not a replacement card or a host security change.
// Browser's ordinary CSS loader requests the exact public source font.
await Bun.write(`${root}/qie-original-font-probe.html`, `<!doctype html><html lang="zh"><meta charset="utf-8"><title>亓厄原字体加载诊断</title><style>${face}</style><h1>亓厄原字体加载诊断</h1><p id="status">正在通过浏览器正常加载原字体</p><p style="font-family:CensyCustomTitleFont,sans-serif">𐙚₊˚那你发誓⊹꙳</p><p>下面是系统字体对照：</p><p style="font-family:sans-serif">𐙚₊˚那你发誓⊹꙳</p><script>
const start=performance.now();
document.fonts.load('14px CensyCustomTitleFont','𐙚₊˚那你发誓⊹꙳').then(fonts=>{
document.getElementById('status').textContent=JSON.stringify({result:fonts.length?'loaded':'no-matching-face',faces:fonts.length,observedAt:new Date().toISOString(),elapsedMs:performance.now()-start});
}).catch(error=>{document.getElementById('status').textContent=JSON.stringify({result:'font-load-failed',error:error.name,observedAt:new Date().toISOString(),elapsedMs:performance.now()-start});});
</script></html>`);
console.log('Prepared isolated public font probe; no target card changes');
