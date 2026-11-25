import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { normalizePublicFrameReplay, repairPublicOpeningContinuationFence, localizeKnownPublicMaskForm, localizeKnownPublicPanelHandlers, localizeKnownPublicAuthorFold } from "../mufy-public-frame-replay";

test('only known captured Fox phone initialization flag is reset for event replay',()=>{
 const nodes='<div class="fox-phone-wrapper initialized"><p>public phone</p></div><div class="other initialized">keep</div>';
 const script=`<script>const wrappers=document.querySelectorAll('.fox-phone-wrapper:not(.initialized)');const sendToUI = (text = "") => {};t.closest('.quick-btn, .action-btn').dataset.cmd;</script>`;
 const result=normalizePublicFrameReplay(nodes+script);expect(result.resetCapturedPhoneInitialization).toBe(1);expect(result.html).toContain('class="fox-phone-wrapper"');expect(result.html).toContain('class="other initialized"');expect(normalizePublicFrameReplay(result.html).resetCapturedPhoneInitialization).toBe(0);expect(normalizePublicFrameReplay(nodes).resetCapturedPhoneInitialization).toBe(0);
});

test('known author note uses its own document without changing visible prose or style',()=>{
 const input='<style>.cv7-fold-stage{color:inherit}</style><div id="cv7AuthorFold" class="cv7-fold-stage"><div class="cv7-toggle" onclick="window.parent.cv7ToggleAuthor()">Author note</div></div><script>(function(){window.parent.cv7ToggleAuthor = function(){const stage = document.getElementById(\'cv7AuthorFold\');if(!stage)return;stage.classList.toggle(\'open\');};})();</script>';
 const result=localizeKnownPublicAuthorFold(input);expect(result.localized).toBe(true);expect(result.html).toContain('onclick="window.cv7ToggleAuthor()"');expect(result.html).toContain('window.cv7ToggleAuthor = function()');expect(result.html).toContain('<style>.cv7-fold-stage{color:inherit}</style>');expect(result.html).toContain('Author note');expect(localizeKnownPublicAuthorFold(result.html).localized).toBe(false);expect(localizeKnownPublicAuthorFold('<p>window.parent.cv7ToggleAuthor()</p>').html).toBe('<p>window.parent.cv7ToggleAuthor()</p>');
});

test('known interview and guide panels keep handlers within their own document',()=>{
 const interview='<div id="xm-slider-v4"></div><div id="xm-dots-v4"><button onclick="window.parent.xmScrollV4(1)">next</button></div><script>const _parentWin_Tt = window.parent;const slider_Ks = d_Obj.getElementById(\'xm-slider-v4\');_parentWin_Tt.xmScrollV4 = function(index){};</script>';
 const guide='<div class="xm-guide-wrapper-v3"><div class="xm-fold-item-v3"><button onclick="window.parent.censyToggleGuideXmV3(this)">open</button></div></div><script>const _pWindow_Mg_xm = window.parent;_pWindow_Mg_xm.censyToggleGuideXmV3 = function(header_Sx){header_Sx.closest(\'.xm-guide-wrapper-v3\');};</script>';
 const input=interview+'<p>Unchanged public prose</p>'+guide,result=localizeKnownPublicPanelHandlers(input);
 expect(result.localizedPanels).toEqual(['interview-v4','guide-xm-v3']);expect(result.html).toContain('const _parentWin_Tt = window;');expect(result.html).toContain('const _pWindow_Mg_xm = window;');expect(result.html).toContain('onclick="window.xmScrollV4(1)"');expect(result.html).toContain('onclick="window.censyToggleGuideXmV3(this)"');expect(result.html).toContain('<p>Unchanged public prose</p>');expect(result.html).not.toContain('host.send');
 expect(localizeKnownPublicPanelHandlers(result.html).localizedPanels).toEqual([]);expect(localizeKnownPublicPanelHandlers('<script>const _parentWin_Tt = window.parent;</script>').html).toBe('<script>const _parentWin_Tt = window.parent;</script>');
});

test('known friend list replays generated click closures without deleting other lists',()=>{
 const nodes='<div id="censy-friend-v11-gray"><button onclick="window.parent.censy_Action_Fold_V11()">fold</button><div id="cenZone-collapse-v11"><div id="cenList-v11"><div>captured friend</div></div></div></div>';
 const script='<script>const _winParent = window.parent;const Z_DATA_V11 = [];const init_List_V11 = function(){const domList=document.getElementById("cenList-v11");if(domList.children.length > 0) return;btn.onclick = () => _winParent.censy_Action_Render_V11(item.id);};_winParent.censy_Action_Render_V11 = function(targetId){};_winParent.censy_Action_Fold_V11 = function(){};</script>';
 const result=normalizePublicFrameReplay(nodes+script);
 expect(result.removedGeneratedFriendNodes).toBe(1);expect(result.html).toContain('const _winParent = window;');expect(result.html).toContain('onclick="window.censy_Action_Fold_V11()"');expect(result.html).toContain('btn.onclick = () => _winParent.censy_Action_Render_V11(item.id)');expect(normalizePublicFrameReplay(result.html).removedGeneratedFriendNodes).toBe(0);
 expect(normalizePublicFrameReplay(nodes).removedGeneratedFriendNodes).toBe(0);expect(normalizePublicFrameReplay(nodes).html).toContain('captured friend');
});

test('only the exact known public mask form gets local handlers without changing clipboard semantics',()=>{
 const form='<div id="censy-mask-form-v7-white"><div id="cm-form-content-v7"></div><div id="cm-title-trigger-v7" onclick="window.parent.censyToggleMaskV7()">form</div><button id="cm-copy-btn-v7" onclick="window.parent.censyExtractDataV7()">extract</button></div>';
 const program='<script>(function(){const _pWindow_Z_CONFIG = window.parent;const d_Doc_Tuan_init = document;_pWindow_Z_CONFIG.censyToggleMaskV7 = function(){};_pWindow_Z_CONFIG.censyExtractDataV7 = function(){const temp_Cmtt={};temp_Cmtt.value = textToCopy;d_Doc_Tuan_init.execCommand(\'copy\');};})();</script>';
 const input='prefix public text\n'+form+program+'\nsuffix unchanged';
 const result=localizeKnownPublicMaskForm(input);
 expect(result.localized).toBe(true);expect(result.html).toStartWith('prefix public text\n');expect(result.html).toEndWith('\nsuffix unchanged');
 expect(result.html).toContain('const _pWindow_Z_CONFIG = window;');expect(result.html).toContain('onclick="window.censyToggleMaskV7()"');expect(result.html).toContain('onclick="window.censyExtractDataV7()"');
 expect(result.html).toContain("d_Doc_Tuan_init.execCommand('copy');");expect(result.html).not.toContain('host.fillComposer');expect(result.html).not.toContain('host.send');expect(localizeKnownPublicMaskForm(result.html).localized).toBe(false);
 expect(localizeKnownPublicMaskForm(form).html).toBe(form);expect(localizeKnownPublicMaskForm(program).html).toBe(program);
 expect(normalizePublicFrameReplay(form+program).html).toContain("d_Doc_Tuan_init.execCommand('copy');");
});

test('known clipboard libraries must not be silently converted into chat draft actions',()=>{
 const avatar=`<div class="censy-avatar-wrapper"><details><summary>AVATAR <span>LIBRARY</span></summary><div class="censy-avatar-content"><img class="censy-avatar-img" src="https://example.com/public.png" onclick="navigator.clipboard.writeText(this.src);alert('Copied!')"></div></details></div>`;
 const oc=`<div id="oc-generator"><div id="oc-output-wrap"><pre id="oc-output-text">public</pre></div></div><script>function ocCopy(){navigator.clipboard.writeText('public')}function ocFallbackCopy(){}</script>`;
 const command=`<div class="cen_cmd_wrap_Sx"><div class="cold_tank_item" data-command="public"><button class="Z_CONFIG_btn" onclick="censyCopyFn_v1(this)">COPY</button><div class="Mm_toast"></div></div></div><script>function censyCopyFn_v1(btn){const parentItem=btn.closest('.cold_tank_item');const fullCommand=parentItem.getAttribute('data-command');navigator.clipboard.writeText(fullCommand)}</script>`;
 const engraved=`<div class="mufy-glass-openings"><div class="mufy-glass-content"><button class="mufy-pill-btn" onclick="var btn=this;var text=btn.closest('.mufy-glass-content').querySelector('.mufy-engraved-text').innerText;navigator.clipboard.writeText(text)">提取</button><div class="mufy-engraved-text">public</div></div></div>`;
 for(const input of[avatar,oc,command,engraved]){const out=normalizePublicFrameReplay(input);expect(out.html).toContain('navigator.clipboard.writeText(');expect(out.html).not.toContain('window.host.fillComposer(');expect(normalizePublicFrameReplay(out.html).html).toBe(out.html);}
});

test('six-field mask staging preserves clipboard copy and never relays generated identity to chat draft',()=>{
 const fields=['name','role','personality','appearance','preference','extra'].map(id=>'<input id="cm-'+id+'-v7">').join('');
 const input='<div id="censy-mask-form-v7-white"><div id="cm-form-content-v7">'+fields+'</div><button id="cm-copy-btn-v7">提取面具</button></div><script>function censyExtractDataV7(){const textToCopy="【角色档案面板】";const temp_Cmtt=document.createElement("textarea");temp_Cmtt.value = textToCopy;temp_Cmtt.select();d_Doc_Tuan_init.execCommand(\'copy\');}</script>';
 const out=normalizePublicFrameReplay(input);expect(out.html).toContain("d_Doc_Tuan_init.execCommand('copy')");expect(out.html).not.toContain('host.fillComposer');expect(normalizePublicFrameReplay(out.html).html).toBe(out.html);
});

test('public glass music hub staging preserves original clipboard instead of chat draft',()=>{
 const input='<div class="mufy-hub-container"><div class="mufy-cmd-card"><button class="mufy-copy-btn">COPY</button>'+[1,2,3,4,5,6].map(n=>`<div class="mufy-cmd-text" id="cmd${n}">public${n}</div>`).join('')+'</div></div><script>function mufyCopyCmd(elementId, btnObj){const textToCopy = document.getElementById(elementId).innerText;navigator.clipboard.writeText(textToCopy)}</script>';
 const out=normalizePublicFrameReplay(input);expect(out.html).toContain('navigator.clipboard.writeText(textToCopy)');expect(out.html).not.toContain('window.host.fillComposer');expect(normalizePublicFrameReplay(out.html).html).toBe(out.html);
});

test("known source gallery removes captured runtime nodes, preserves generator, styles and public copy text", () => {
  const input = `<html><head><style>.qt{color:inherit}</style></head><body><p>navigator.clipboard.writeText(example)</p><div id="qtGridCouple"><div><img src="https://example.com/a.png"></div><div><img src="https://example.com/b.png"></div></div><script>const coupleImgs=['https://example.com/a.png','https://example.com/b.png'];function renderGrid(){};renderGrid(coupleImgs, 'qtGridCouple', 'qtCountCouple');throw Error('must not execute');</script><button onclick="navigator.clipboard.writeText('safe public fixture')">copy</button><script>/* __MUFY_ARTIFACT_BRIDGE__ */</script></body></html>`;
  const result = normalizePublicFrameReplay(input),
    dom = new JSDOM(result.html);
  expect(result.removedGeneratedGalleryNodes).toBe(2);
  expect(result.removedPlatformScripts).toBe(1);
  expect(
    dom.window.document.querySelector("#qtGridCouple")?.children.length,
  ).toBe(0);
  expect(result.html).toContain(
    "renderGrid(coupleImgs, 'qtGridCouple', 'qtCountCouple')",
  );
  expect(result.html).toContain(".qt{color:inherit}");
  expect(dom.window.document.querySelector("p")?.textContent).toBe(
    "navigator.clipboard.writeText(example)",
  );
  expect(
    dom.window.document.querySelector("button")?.getAttribute("onclick"),
  ).toContain("window.host.fillComposer(");
  expect(normalizePublicFrameReplay(result.html).html).toBe(result.html);
  dom.window.close();
});
test("unrecognized source generators and ordinary static galleries are never emptied", () => {
  const result = normalizePublicFrameReplay(
    '<div id="qtGridCouple"><img src="https://example.com/a.png"></div><script>function renderGrid(){};renderGrid(otherData,"anotherGrid")</script>',
  );
  expect(result.removedGeneratedGalleryNodes).toBe(0);
  expect(result.html).toContain('<img src="https://example.com/a.png">');
});

test('known detached-audio replay starts at zero instead of a captured old percentage',()=>{
 const fragment='<div id="censy-shard-player"><div id="shard-progress-bar" style="width:86.0374%;background:gold"></div></div>';
 const script='<script>const p=document.getElementById("shard-progress-bar");let audio=new Audio();audio.ontimeupdate=()=>{const pct=(audio.currentTime / audio.duration)*100;p.style.width=pct+"%"};</script>';
 const result=normalizePublicFrameReplay(fragment+script);
 expect(result.resetCapturedMediaProgress).toBe(1);
 expect(result.html).toContain('width: 0%;');expect(result.html).toContain('background: gold');
 expect(normalizePublicFrameReplay(result.html).resetCapturedMediaProgress).toBe(0);
 const unrelated=normalizePublicFrameReplay(fragment+'<script>/* unrelated static progress */</script>');
 expect(unrelated.resetCapturedMediaProgress).toBe(0);expect(unrelated.html).toContain('width:86.0374%');
});

test("selected textarea fallback with success assignment relays the actual public command", () => {
  const input='<p>document.execCommand(\'copy\')</p><script>function fallback(){const area=document.createElement("textarea");area.value="public fixture";area.select(); const successful = document.execCommand(\'copy\'); area.remove();if(successful)showToast();}</script>';
  const result=normalizePublicFrameReplay(input);
  expect(result.html).toContain('window.host.fillComposer(area.value), true');
  expect(result.html).toContain('if(successful)showToast()');
  expect(result.html).toContain("<p>document.execCommand('copy')</p>");
  expect(normalizePublicFrameReplay(result.html).html).toBe(result.html);
});

test('nested source continuation fence is removed only inside its open document',()=>{
 const continuation='\n```html\n<script>\n(function(){\n  try {\n    const pDoc = window.parent.document;\n}catch(e){}\n})();</script>';
 const input='```html\n<!DOCTYPE html><html><body><style>.source{color:inherit}</style>'+continuation+'\n</body></html>\n```';
 const repaired=repairPublicOpeningContinuationFence(input);
 expect(repaired.removed).toBe(1);expect(repaired.html.length).toBe(input.length-8);
 expect(repaired.html).toContain('const pDoc = window.parent.document;');
 expect(repairPublicOpeningContinuationFence(repaired.html).removed).toBe(0);
 expect(repairPublicOpeningContinuationFence('```html\n<html></html>\n```'+continuation).removed).toBe(0);
 expect(repairPublicOpeningContinuationFence(continuation).removed).toBe(0);
});
