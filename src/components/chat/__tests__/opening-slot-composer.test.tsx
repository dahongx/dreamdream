import {expect,mock,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
const observed:{srcdoc?:string;onFillComposer?:(text:string)=>void;onSendMessage?:(text:string)=>void}[]=[];
mock.module('@/components/regex/RegexIframe',()=>({RegexIframe:(props:{srcdoc?:string;onFillComposer?:(text:string)=>void;onSendMessage?:(text:string)=>void})=>{observed.push(props);return null;},createCaptureState:()=>({})}));
const {OpeningSlot}=await import('../OpeningSlot');
test('opening frame receives the separate draft callback without auto-send',()=>{
 let draft='',sends=0;
 const fill=(text:string)=>{draft=text;};
 renderToStaticMarkup(<OpeningSlot components={[{id:'fixture',packId:'fixture',name:'public command',content:'<div>public command</div>',enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}]} character={{id:'fixture',name:'Fixture',avatarUrl:null,tags:[],bio:null}} userName="Fixture" onFillComposer={fill} onSendMessage={()=>{sends++;}} />);
 expect(observed).toHaveLength(1);
 expect(observed[0].onFillComposer).toBe(fill);
 observed[0].onFillComposer?.('public command');
 expect(draft).toBe('public command');
 expect(sends).toBe(0);
});
test('chat message list forwards its existing draft handler to opening slot',async()=>{
 const source=await Bun.file('src/components/chat/ChatMessagesList.tsx').text();
 const slot=source.match(/<OpeningSlot\b[\s\S]*?\/>/)?.[0];
 expect(slot).toContain('onFillComposer={onFillComposer}');
});

test('only known imported parent tabs regain their inherited border-box model',()=>{
 const tabs='<div class="censy-gf-tabs"><details class="censy-gf-details"><summary>前世</summary><p>公开资料</p></details></div>';
 const marker='<style data-mufy-adaptation="mobile-box-model"></style>';
 for(const [content,expected] of [[marker+tabs,true],[tabs,false],[marker+'<html><body>'+tabs+'</body></html>',false]] as const){
  observed.length=0;
  renderToStaticMarkup(<OpeningSlot components={[{id:'box-fixture',packId:'fixture',name:'public tabs',content,enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}]} character={{id:'fixture',name:'Fixture',avatarUrl:null,tags:[],bio:null}} userName="Fixture" onSendMessage={()=>{throw Error('NO_SEND');}}/>);
  expect(observed.some(p=>p.srcdoc?.includes('data-nj-mufy-parent-box'))).toBe(expected);
  if(expected)expect(observed.find(p=>p.srcdoc?.includes('data-nj-mufy-parent-box'))!.srcdoc).toContain('box-sizing:border-box');
 }
});

test('only standalone adapted documents regain their measured source font default',()=>{
 const marker='<style data-mufy-adaptation="mobile-box-model"></style>';
 const doc='<html><head><style>html{width:100%;height:fit-content;overflow:hidden;box-sizing:border-box;}body{width:100%;min-height:100%;height:auto;margin:0;padding:0;box-sizing:border-box;}summary{color:white;}</style></head><body><p>公开装饰文字</p></body></html>';
 for(const [content,expected] of [[marker+doc,true],[doc,false],[marker+'<div>parent fragment</div>',false],[marker+'<style data-mufy-source-skin></style>'+doc,false],[marker+'<style data-mufy-rendered-opening></style>'+doc,false]] as const){
  observed.length=0;
  renderToStaticMarkup(<OpeningSlot components={[{id:'font-fixture',packId:'fixture',name:'public font',content,enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}]} character={{id:'fixture',name:'Fixture',avatarUrl:null,tags:[],bio:null}} userName="Fixture" onSendMessage={()=>{throw Error('NO_SEND');}}/>);
  const found=observed.find(p=>p.srcdoc?.includes('data-nj-mufy-document-font'));
  expect({content,found:Boolean(found)}).toEqual({content,found:expected});
  expect(observed.some(p=>p.srcdoc?.includes('data-nj-mufy-source-canvas-boundary'))).toBe(expected);
  if(found){expect(found.srcdoc).toContain('body{font-family:"Noto Sans SC"}');expect(found.srcdoc).not.toContain('font-family:"Noto Sans SC"!important');}
 }
});

test('source document font fallback precedes and preserves an explicit author font',()=>{
 observed.length=0;
 const author='<style>body{font-family:Georgia,serif}.panel{font-family:monospace}</style>';
 const content='<style data-mufy-adaptation="mobile-box-model"></style><html><body>'+author+'<div class="panel">公开资料</div></body></html>';
 renderToStaticMarkup(<OpeningSlot components={[{id:'font-author',packId:'fixture',name:'author font',content,enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}]} character={{id:'fixture',name:'Fixture',avatarUrl:null,tags:[],bio:null}} userName="Fixture" onSendMessage={()=>{throw Error('NO_SEND');}}/>);
 const frame=observed.find(p=>p.srcdoc?.includes('data-nj-mufy-document-font'))!.srcdoc!;
 expect(frame).toContain(author);
 expect(frame.indexOf('data-nj-mufy-document-font')).toBeLessThan(frame.indexOf(author));
});
