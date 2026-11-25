import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {OpeningSlot} from '../src/components/chat/OpeningSlot';
import {MufySourceControls} from '../src/components/chat/MufySourceControls';
import {ChatInputToolbar} from '../src/components/chat/ChatInputToolbar';
import controls from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/26/native-page-controls/sidebar-spec.json';
import type {NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
declare const __PUBLIC_FRAME__: string;
const components=[{id:'player-name-fixture',packId:'fixture',name:'Public JianXingZhou introduction',content:'<style data-mufy-adaptation="mobile-box-model"></style>'+__PUBLIC_FRAME__,enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}];
function Preview(){
 const [name,setName]=useState('玩家甲'),[sends,setSends]=useState(0);
 const [draft,setDraft]=useState(''),inputRef=useRef<HTMLTextAreaElement|null>(null);
 return <I18nProvider locale="zh-TW" dict={zh}><main>
  <h1>玩家名称绑定 · 本地未发布</h1><p>公开介绍原文，真实 OpeningSlot/RegexIframe；无账号、模型或数据库。</p>
  <label>玩家／面具名称<input id="qa-player-name" value={name} onChange={e=>setName(e.target.value)}/></label>
  <output id="qa-sends">发送次数：{sends}</output>
  <section id="qa-controls"><p>真实工具栏和来源快捷按钮；四个原生按钮以测试尺寸占位，不调用服务。</p>
   <ChatInputToolbar wrap>
    <button type="button" className="qa-native" style={{width:40}}>重说</button><button type="button" className="qa-native" style={{width:40}}>面具</button><button type="button" className="qa-native" style={{width:160}}>SONNET 4.6</button><button type="button" className="qa-native" style={{width:42}}>银 2</button>
    <MufySourceControls spec={controls as NativeImageSidebar} inputRef={inputRef} onChange={setDraft}/>
   </ChatInputToolbar>
   <div id="nj_chat_input_box"><textarea id="nj_chat_input_textarea" aria-label="快捷按钮测试草稿" ref={inputRef} value={draft} onChange={e=>setDraft(e.target.value)}/></div>
  </section>
  <OpeningSlot components={components} character={{id:'fixture',name:'简行舟',avatarUrl:null,tags:[],bio:null}} userName={name} onSendMessage={()=>setSends(v=>v+1)}/>
 </main></I18nProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
