import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { I18nProvider } from "@/i18n/client";
import { zh } from "@/i18n/zh";

for(const variant of ['ins-music','zen-music','static-music','glass-music'] as const)test(`${variant} retains one opaque frame and state on parent renders and reopen`,async()=>{
 const dom=new JSDOM('<div id="ins-root"></div>');
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),{MufyNativeImageSidebar}=await import('../MufyNativeImageSidebar');
 const root=createRoot(document.getElementById('ins-root')!);
 const sourceBase=variant==='static-music'?'<head><style>html{width:100%;height:fit-content;overflow:hidden;box-sizing:border-box;}body{width:100%;min-height:100%;height:auto;margin:0;padding:0;box-sizing:border-box;}summary{color:white;}</style></head>':'';
 const spec={version:1 as const,variant,shellHtml:variant==='static-music'?'<details class="static-music-sidebar"><summary class="static-music-trigger" onclick="bad()">Music</summary><div class="static-music-panel"><div data-nj-native-documents></div></div></details>':variant==='zen-music'?'<details class="zen-music-sidebar"><summary class="zen-trigger" onclick="bad()">Music</summary><div class="zen-host-panel"><div class="zen-close" tabindex="0">Close</div><div data-nj-native-documents></div></div></details>':'<details class="ins-music-sidebar"><summary class="ins-trigger" onclick="bad()">Music</summary><div class="ins-host-panel"><div data-nj-native-documents></div></div></details>',css:'.ins-trigger{color:inherit}',documents:['<html>'+sourceBase+'<body><p>synthetic music UI</p></body></html>'],framePresentation:{minHeight:380,borderRadius:0}};
 if(variant==='glass-music'){
  spec.shellHtml='<details class="glass-music-sidebar"><summary class="glass-trigger">Music</summary><div class="glass-panel"><div data-nj-native-documents></div></div></details>';
  spec.documents=['<html><body><div class="mufy-hub-container"><div class="mufy-cmd-card"><button class="mufy-copy-btn">COPY</button>'+[1,2,3,4,5,6].map(n=>'<div id="cmd'+n+'">public</div>').join('')+'</div></div><script>function mufyCopyCmd(elementId, btnObj){const textToCopy = document.getElementById(elementId).innerText;window.host.fillComposer(textToCopy)}</script></body></html>'];
 }
 const render=()=>root.render(<I18nProvider locale="zh-TW" dict={zh}><MufyNativeImageSidebar spec={{...spec}} widgetKey="ins-fixture" character={{id:'fixture',name:'Fixture',avatarUrl:null,bio:null,tags:[]}} userName="Fixture" onSendMessage={()=>{}} onOpenChange={()=>{}}/></I18nProvider>);
 try{
  await act(async()=>render());const host=document.querySelector('[data-nj-native-image-sidebar]')!,shadow=host.shadowRoot!,details=shadow.querySelector('details')!;
  expect(shadow.querySelectorAll('iframe')).toHaveLength(0);expect(shadow.querySelector('summary')!.hasAttribute('onclick')).toBe(false);
  await act(async()=>{details.open=true;details.dispatchEvent(new dom.window.Event('toggle'));});
  const frame=shadow.querySelector('iframe')!;expect(frame).not.toBeNull();expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  expect(frame.getAttribute('srcdoc')?.includes("Object.defineProperty(window, 'parent', { value: shim")).toBe(variant!=='glass-music');
  expect(frame.getAttribute('srcdoc')?.includes('data-nj-mufy-source-canvas-boundary')).toBe(variant==='static-music');
  if(variant==='static-music'){expect(frame.getAttribute('srcdoc')).toContain('font-family:"Noto Sans SC"');expect(frame.getAttribute('srcdoc')).toContain('color:rgb(0,0,0)');}
  await act(async()=>render());expect(details.open).toBe(true);expect(shadow.querySelector('iframe')).toBe(frame);
  if(variant==='zen-music'){
   await act(async()=>{shadow.querySelector('.zen-close')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
   expect(details.open).toBe(false);expect(shadow.querySelector('iframe')).toBe(frame);
   await act(async()=>{details.open=true;details.dispatchEvent(new dom.window.Event('toggle'));});
   await act(async()=>{shadow.querySelector('.zen-close')!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));});
   expect(details.open).toBe(false);expect(shadow.querySelector('iframe')).toBe(frame);
  }
  await act(async()=>{details.open=false;details.dispatchEvent(new dom.window.Event('toggle'));});expect(shadow.querySelector('iframe')).toBe(frame);
  await act(async()=>{details.open=true;details.dispatchEvent(new dom.window.Event('toggle'));});expect(shadow.querySelectorAll('iframe')).toHaveLength(1);expect(shadow.querySelector('iframe')).toBe(frame);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of prior)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
});

test('focus drawer keeps one opaque program through parent updates and removes its mask on close',async()=>{
 const dom=new JSDOM('<div id="focus-root"></div><input id="outside">');
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client');
 const {MufyNativeImageSidebar}=await import('../MufyNativeImageSidebar');
 const root=createRoot(document.getElementById('focus-root')!);
 const spec={version:1 as const,variant:'black-focus' as const,shellHtml:'<div><div class="midnight-black-trigger" tabindex="0" onclick="bad()"></div><div class="midnight-black-container" tabindex="-1"><div data-nj-native-documents></div></div><div class="close-mask-black"></div></div>',css:'.midnight-black-container{color:#eaeaea}',documents:['<html><body><p>synthetic public program</p></body></html>']};
 const changes:boolean[]=[];
 const render=()=>root.render(<I18nProvider locale="zh-TW" dict={zh}><MufyNativeImageSidebar spec={{...spec}} widgetKey="focus-fixture" character={{id:'fixture',name:'Fixture',avatarUrl:null,bio:null,tags:[]}} userName="Fixture" onSendMessage={()=>{}} onOpenChange={v=>changes.push(v)}/></I18nProvider>);
 try{
  await act(async()=>render());
  const host=document.querySelector('[data-nj-native-image-sidebar]')!,shadow=host.shadowRoot!,trigger=shadow.querySelector('.midnight-black-trigger')!;
  expect(trigger.hasAttribute('onclick')).toBe(false);expect(trigger.getAttribute('tabindex')).toBe('0');expect(shadow.querySelectorAll('iframe')).toHaveLength(0);
  await act(async()=>{trigger.dispatchEvent(new dom.window.FocusEvent('focus'));});
  const frame=shadow.querySelector('iframe')!;
  expect(frame).not.toBeNull();expect(frame.getAttribute('sandbox')).toBe('allow-scripts');expect(shadow.querySelector('[data-nj-native-focus-open]')?.getAttribute('data-nj-native-focus-open')).toBe('true');
  await act(async()=>render());
  expect(shadow.querySelector('iframe')).toBe(frame);expect(shadow.querySelectorAll('iframe')).toHaveLength(1);expect(changes.at(-1)).toBe(true);
  await act(async()=>{shadow.querySelector('.close-mask-black')!.dispatchEvent(new dom.window.MouseEvent('click'));});
  expect(shadow.querySelector('[data-nj-native-focus-open]')?.getAttribute('data-nj-native-focus-open')).toBe('false');expect(changes.at(-1)).toBe(false);expect(shadow.querySelector('iframe')).toBe(frame);
  expect(shadow.querySelector('style')?.textContent).toContain('display:none!important');
 }finally{
  await act(async()=>root.unmount());dom.window.close();
  for(const [key,descriptor]of prior)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);
 }
});

test("five real opaque frames retain identity through native drawer toggles and stream rerenders", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const prior = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  const { createRoot } = await import("react-dom/client");
  const { MufyNativeImageSidebar } = await import("../MufyNativeImageSidebar");
  const root = createRoot(document.getElementById("root")!);
  const changes: boolean[] = [];
  const spec = {
    version: 1 as const,
    framePresentation: { minHeight: 100, borderRadius: 12 },
    shellHtml:
      '<details class="mufy-side-r"><summary class="mufy-side-btn" onclick="bad()"><img class="mufy-side-icon" src="https://example.com/source.png" onerror="bad()"></summary><div class="mufy-side-panel"><script>bad()</script><div class="mufy-side-inner"><div data-nj-native-documents></div></div></div></details>',
    css: ".mufy-side-panel{background:rgba(255,255,255,.08);border-radius:4px}.mufy-side-icon{width:48px;height:48px}",
    documents: Array.from(
      { length: 5 },
      (_, index) =>
        `<html><body><div>synthetic document ${index}</div><script>var privateCounter=${index};</script></body></html>`,
    ),
  };
  const render = () =>
    root.render(
      <I18nProvider locale="zh-TW" dict={zh}>
        <MufyNativeImageSidebar
          spec={{ ...spec }}
          widgetKey="fixture"
          character={{
            id: "fixture",
            name: "Fixture",
            avatarUrl: null,
            bio: null,
            tags: [],
          }}
          userName="fixture"
          onSendMessage={() => {}}
          onOpenChange={(open) => changes.push(open)}
        />
      </I18nProvider>,
    );
  try {
    await act(async () => render());
    const host = document.querySelector("[data-nj-native-image-sidebar]")!;
    const shadow = host.shadowRoot!;
    expect(shadow.querySelector("script")).toBeNull();
    expect(shadow.querySelector("[onclick],[onerror]")).toBeNull();
    expect(shadow.querySelectorAll("iframe")).toHaveLength(0);
    expect(shadow.innerHTML).toContain("data-nj-native-documents");
    expect(shadow.querySelector("[data-nj-native-documents]")).not.toBeNull();
    expect(shadow.querySelector("details.mufy-side-r")).not.toBeNull();
    const details = shadow.querySelector("details")!;
    await act(async () => {
      details.setAttribute("open", "");
      details.dispatchEvent(new dom.window.Event("toggle"));
    });
    const frames = [...shadow.querySelectorAll("iframe")];
    expect(frames).toHaveLength(5);
    for (let index = 0; index < frames.length; index++) {
      expect(frames[index].getAttribute("sandbox")).toBe("allow-scripts");
      expect(frames[index].getAttribute("src")).toBeNull();
      expect(frames[index].style.minHeight).toBe("100px");
      expect(frames[index].srcdoc).toContain(`synthetic document ${index}`);
      expect(frames[index].srcdoc).not.toContain(
        `synthetic document ${(index + 1) % 5}`,
      );
      expect(frames[index].srcdoc).toContain("frame-src 'none'");
      expect(frames[index].srcdoc).toContain('data-nj-opening-canvas');
      expect(frames[index].srcdoc).not.toContain('function findSidebar()');
    }
    expect(host.className).toContain("w-[min(326px,100vw)]");
    expect(changes.at(-1)).toBe(true);
    await act(async () => render());
    expect([...shadow.querySelectorAll("iframe")]).toEqual(frames);
    expect(details.hasAttribute("open")).toBe(true);
    await act(async () => {
      details.removeAttribute("open");
      details.dispatchEvent(new dom.window.Event("toggle"));
    });
    expect(host.className).toContain("w-[61px] h-[60px]");
    expect(changes.at(-1)).toBe(false);
    expect([...shadow.querySelectorAll("iframe")]).toEqual(frames);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
