import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {buildIframeSrcdoc,hasOfficialBilibiliPlayer,normalizeOfficialBilibiliPlayer,isMufyTestBilibiliHost,standaloneOfficialBilibiliUrl} from '../regex/iframe-bridge';

describe('opening frame content height',()=>{
 test('in-flow source parent alias never opts into floater viewport sizing or polling',()=>{
  const source=buildIframeSrcdoc({srcdoc:'<p>source inline fixture</p>',captureGroups:[],cssScope:'opening',inlineParentShim:true});
  expect(source).toContain('<body data-character-css="opening" data-nj-opening-canvas>');
  expect(source).toContain('var realParent = window.parent');
  expect(source).not.toContain('function findSidebar()');
  expect(source).toContain("frame-src 'none'");
  expect(source).toContain("connect-src 'none'");
  expect(source).not.toContain('allow-same-origin');
 });
 test('standalone official media never upgrades mixed or arbitrary author pages',()=>{
  const parse=(s:string)=>standaloneOfficialBilibiliUrl(new JSDOM(s).window.document);
  expect(parse('<div data-nj-doc><script>/* source wrapper */</script><iframe src="//player.bilibili.com/player.html?bvid=fixture"></iframe></div>')).toBe('https://player.bilibili.com/player.html?bvid=fixture');
  for(const source of ['<p>author text</p><iframe src="https://player.bilibili.com/player.html"></iframe>','<iframe src="https://player.bilibili.com/player.html" srcdoc="hello"></iframe>','<iframe src="https://player.bilibili.com.evil.test/player.html"></iframe>','<iframe src="https://player.bilibili.com/player.html"></iframe><iframe src="https://evil.test"></iframe>','<iframe src="https://player.bilibili.com/other"></iframe>'])expect(parse(source)).toBeNull();
 });
 test('legacy protocol-relative official players are upgraded only with explicit permission',()=>{
  const legacy='<iframe src="//player.bilibili.com/player.html?bvid=fixture"></iframe>';
  expect(hasOfficialBilibiliPlayer(legacy)).toBe(true);
  expect(hasOfficialBilibiliPlayer('<iframe src = "https://player.bilibili.com/player.html"></iframe>')).toBe(true);
  for(const url of ['//player.bilibili.com.evil.test/player.html','//player.bilibili.com/other','http://player.bilibili.com/player.html'])expect(hasOfficialBilibiliPlayer(`<iframe src="${url}"></iframe>`)).toBe(false);
  expect(normalizeOfficialBilibiliPlayer(legacy)).toContain('src="https://player.bilibili.com/player.html?bvid=fixture"');
  expect(buildIframeSrcdoc({srcdoc:legacy,captureGroups:[],allowBilibiliPlayer:true})).toContain('src="https://player.bilibili.com/player.html?bvid=fixture"');
  expect(buildIframeSrcdoc({srcdoc:legacy,captureGroups:[]})).toContain(legacy);
 });
 test('approved official player is TEST-only and keeps all other sandbox network restrictions',()=>{
  expect(isMufyTestBilibiliHost('http://115.29.213.73:8091')).toBe(true);
  for(const origin of ['https://dearm.ai','http://115.29.213.73:8090','https://115.29.213.73:8091','http://115.29.213.73:8091.evil.test'])expect(isMufyTestBilibiliHost(origin)).toBe(false);
  const src=buildIframeSrcdoc({srcdoc:'<p>fixture</p>',captureGroups:[],allowBilibiliPlayer:true});
  expect(src).toContain('frame-src https://player.bilibili.com/player.html');
  expect(src).toContain("connect-src 'none'");
  expect(src).not.toContain('allow-same-origin');
  expect(buildIframeSrcdoc({srcdoc:'<p>fixture</p>',captureGroups:[]})).toContain("frame-src 'none'");
 });
 test('marks only in-flow opening canvases without changing sandbox policy',()=>{
  const opening=buildIframeSrcdoc({srcdoc:'<p>fixture</p>',captureGroups:[],cssScope:'opening'});
  expect(opening).toContain('<body data-character-css="opening" data-nj-opening-canvas>');
  expect(opening).toContain('frame-src \'none\'');
  const floating=buildIframeSrcdoc({srcdoc:'<p>fixture</p>',captureGroups:[],cssScope:'opening',parentShim:true});
  expect(floating).not.toContain('<body data-character-css="opening" data-nj-opening-canvas>');
  const regular=buildIframeSrcdoc({srcdoc:'<p>fixture</p>',captureGroups:[],cssScope:'other'});
  expect(regular).not.toContain('<body data-character-css="other" data-nj-opening-canvas>');
 });
 test('late host subscription recovers a lost first height and ignores previous viewport height',async()=>{
  const html=buildIframeSrcdoc({srcdoc:'<p>synthetic component</p>',captureGroups:[],cssScope:'opening'});
  const dom=new JSDOM(html),doc=dom.window.document,messages:unknown[]=[];
  Object.defineProperty(doc.documentElement,'scrollHeight',{value:900});
  Object.defineProperty(doc.body,'scrollHeight',{value:173});
  Object.defineProperty(doc.body,'offsetHeight',{value:173});
  doc.body.getBoundingClientRect=()=>({height:173}) as DOMRect;
  const reporter=[...doc.querySelectorAll('script')].map(e=>e.textContent??'').find(text=>text.includes('function measure()')&&text.includes('new ResizeObserver(measure)'))!;
  const ready=new Promise<void>(resolve=>dom.window.addEventListener('load',()=>resolve(),{once:true}));
  new Function('document','window','parent','ResizeObserver',reporter)(doc,dom.window,{postMessage(value:unknown){messages.push(value);}},class{observe(){}});
  await ready;
  expect(messages.at(-1)).toEqual({type:'resize',height:173});
  messages.length=0; // The parent subscribed after this first notification.
  dom.window.dispatchEvent(new dom.window.Event('host-ready'));
  expect(messages).toEqual([{type:'resize',height:173}]);
  dom.window.close();
 });
});
