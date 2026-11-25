/** Production routing, public-only shell, no account/history/model/database. */
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FloatingSlot} from '../src/components/chat/FloatingSlot';
import {OpeningSlot} from '../src/components/chat/OpeningSlot';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {nativeImageSidebarEnvelope,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
import spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/32/ghost-instructions/sidebar-spec.json';
const components=[{id:'ghost-fixture',packId:'fixture',name:'public instructions',content:nativeImageSidebarEnvelope(spec as NativeImageSidebar),enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}];
const character={id:'fixture',name:'唐志泽',avatarUrl:null,bio:null,tags:[]};
function Preview(){const[renders,setRenders]=useState(0),[sends,setSends]=useState(0);return <I18nProvider locale="zh-TW" dict={zh}><main><h1>左侧指令窗 · 本地未发布</h1><p>原始公开五条指令与样式。没有作者脚本或账号数据。</p><button onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.preventDefault()} onClick={()=>setRenders(v=>v+1)}>模拟回复重绘</button><output>重绘次数：{renders}</output><OpeningSlot components={components} character={character} userName="Fixture" onSendMessage={()=>setSends(v=>v+1)}/><label>关闭后输入<textarea placeholder="仅检查焦点，不发送"/></label><p>发送次数：<output>{sends}</output></p></main><FloatingSlot components={components} character={character} userName="Fixture" onSendMessage={()=>setSends(v=>v+1)}/></I18nProvider>}
createRoot(document.getElementById('preview-root')!).render(<Preview/>);
