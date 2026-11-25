import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act} from 'react';
test('story keeps one opaque viewport through parent repaint and accepts close only from its own frame',async()=>{
 const dom=new JSDOM('<div id="story-root"></div>',{pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),{MufyFullscreenStory}=await import('../MufyFullscreenStory');
 const root=createRoot(document.getElementById('story-root')!);
 const spec={version:1 as const,kind:'censy-v19' as const,triggerCss:'.censy-anchor-v19{height:150px}',document:'<html><body><script>window.parent.censyStartV19 = function(){var stage=document.createElement("div");stage.id = \'censy-v19-stage\';}</script></body></html>'};
 const render=()=>root.render(<MufyFullscreenStory widgetKey="fixture" spec={{...spec}}/>);
 try{
  await act(async()=>render());const trigger=document.querySelector('[data-nj-fullscreen-story-trigger]')!.shadowRoot!.querySelector('[role="button"]')!;
  expect(document.querySelector('iframe')).toBeNull();expect(trigger.getAttribute('onclick')).toBeNull();
  await act(async()=>{trigger.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
  const frame=document.querySelector('iframe')!;expect(frame).not.toBeNull();expect(frame.getAttribute('sandbox')).toBe('allow-scripts');expect(frame.style.height).toBe('100%');expect(Number(document.querySelector<HTMLElement>('[data-nj-fullscreen-story]')!.style.zIndex)).toBeLessThan(44);expect(Number(document.querySelector<HTMLElement>('[data-nj-fullscreen-story]')!.style.zIndex)).toBeGreaterThan(3);expect(frame.getAttribute('src')).toBeNull();expect(frame.srcdoc).not.toContain('allow-same-origin');expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
  await act(async()=>render());expect(document.querySelector('iframe')).toBe(frame);expect(document.querySelectorAll('iframe')).toHaveLength(1);
  await act(async()=>{dom.window.dispatchEvent(new dom.window.MessageEvent('message',{source:dom.window,data:{type:'nj_mufy_fullscreen_story_closed'}}));});expect(document.querySelector('iframe')).toBe(frame);
  await act(async()=>{dom.window.dispatchEvent(new dom.window.MessageEvent('message',{source:frame.contentWindow,data:{type:'nj_mufy_fullscreen_story_closed'}}));});expect(document.querySelector('iframe')).toBeNull();expect(document.querySelector('[role="dialog"]')).toBeNull();
  await act(async()=>{trigger.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));});expect(document.querySelectorAll('iframe')).toHaveLength(1);
  await act(async()=>{document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});expect(document.querySelector('iframe')).toBeNull();expect(document.querySelector('[role="dialog"]')).toBeNull();
  const profile={version:1 as const,kind:'censy-profile-v9' as const,triggerCss:'.cenConfig_anchor_v9{height:380px}',triggerMarkup:'<div class="Tt_name_glow_v9" onclick="bad()">江<img src="x" onerror="bad()"></div>',triggerLabel:'江之余 · 人物档案',inheritedFont:'STSong, SimSun, "Noto Serif SC", serif',inheritedColor:'rgb(122, 31, 31)',inheritedLineHeight:1.8,document:'<html><body><script>function Sx_init_v9(){let mask=document.createElement("div");mask.id = \'Tuan_cover_v9\';window.parent.Cmtt_off_v9 = function(){};}</script></body></html>'};
  await act(async()=>root.render(<MufyFullscreenStory widgetKey="profile" spec={profile}/>));
  const profileTrigger=document.querySelector('[data-nj-fullscreen-story-trigger]')!.shadowRoot!.querySelector('[role="button"]')!;
  expect(profileTrigger.className).toBe('cenConfig_anchor_v9');expect(profileTrigger.getAttribute('aria-label')).toBe('江之余 · 人物档案');expect(profileTrigger.querySelector('[onclick],img,script')).toBeNull();
  await act(async()=>profileTrigger.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
  const profileFrame=document.querySelector('iframe')!;
  expect(profileFrame.getAttribute('sandbox')).toBe('allow-scripts');expect(document.querySelector<HTMLElement>('[data-nj-fullscreen-story]')!.style.zIndex).toBe('10000');expect(profileFrame.srcdoc).toContain('window.Sx_init_v9()');expect(profileFrame.srcdoc).toContain('line-height:1.8');expect(document.querySelector<HTMLElement>('[role="dialog"]')!.style.width).toBe('100vw');expect(document.querySelector<HTMLElement>('[role="dialog"]')!.style.height).toBe('100dvh');
  await act(async()=>root.render(<MufyFullscreenStory widgetKey="profile" spec={{...profile}}/>));expect(document.querySelector('iframe')).toBe(profileFrame);
  await act(async()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{source:dom.window,data:{type:'nj_mufy_fullscreen_story_closed'}})));expect(document.querySelector('iframe')).toBe(profileFrame);
  await act(async()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{source:profileFrame.contentWindow,data:{type:'nj_mufy_fullscreen_story_closed'}})));expect(document.querySelector('iframe')).toBeNull();
  await act(async()=>profileTrigger.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));expect(document.querySelectorAll('iframe')).toHaveLength(1);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('iframe')).toBeNull();
  const timeline={version:1 as const,kind:'censy-timeline-v10' as const,document:'',triggerCss:'.Tuan_node_v10{color:white}',triggerMarkup:'<div id="Z_CONFIG-xm-timeline-v10-fix"><div id="Z_CONFIG_btn_xm_v10">履历</div>'+[0,1,2,3].map(i=>'<div class="Tuan_node_v10">'+i+'</div>').join('')+'</div>',entries:[0,1,2,3].map(i=>({label:'记录'+i,modalMarkup:'<div><h3>公开事实'+i+'</h3><div id="Z_CONFIG_close_xm_v10">关闭档案</div></div>'}))};
  await act(async()=>root.render(<MufyFullscreenStory widgetKey="timeline" spec={timeline}/>));
  const timelineShadow=document.querySelector('[data-nj-public-timeline]')!.shadowRoot!;
  await act(async()=>timelineShadow.querySelector('#Z_CONFIG_btn_xm_v10')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
  expect(timelineShadow.querySelector('#Z_CONFIG-xm-timeline-v10-fix')!.classList.contains('expanded')).toBe(true);
  const nodes=timelineShadow.querySelectorAll('.Tuan_node_v10');expect(nodes).toHaveLength(4);
  for(let i=0;i<4;i++){
   await act(async()=>nodes[i].dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
   const modal=document.querySelector('[data-nj-public-timeline-modal]')!;
   expect(modal.textContent).toContain('公开事实'+i);expect(modal.getAttribute('aria-modal')).toBe('true');expect(document.querySelector('iframe')).toBeNull();expect((modal as HTMLElement).style.width).toBe('100vw');
   await act(async()=>root.render(<MufyFullscreenStory widgetKey="timeline" spec={{...timeline}}/>));expect(document.querySelector('[data-nj-public-timeline-modal]')).toBe(modal);
   await act(async()=>document.querySelector('#Z_CONFIG_close_xm_v10')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
   expect(document.querySelector('[data-nj-public-timeline-modal]')).toBeNull();
  }
  await act(async()=>nodes[0].dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(document.querySelector('[data-nj-public-timeline-modal]')).toBeNull();expect(document.querySelector('iframe')).toBeNull();
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
