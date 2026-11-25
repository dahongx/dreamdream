import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {OpeningSlot} from '../src/components/chat/OpeningSlot';
import source from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/26/inline-music/source-program.json';
const components=[{id:'public-inline-music',packId:'fixture',name:'public source music',content:source.content,enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}];
function Preview(){const[draft,setDraft]=useState(''),[sends,setSends]=useState(0);return <I18nProvider locale="zh-TW" dict={zh}><main><h1>音乐组件 · 本地未发布</h1><p>只加载原站公开音乐组件，无账号、模型或数据库。</p><OpeningSlot components={components} character={{id:'fixture',name:'Fixture',avatarUrl:null,tags:[],bio:null}} userName="Fixture" onFillComposer={setDraft} onSendMessage={()=>setSends(n=>n+1)}/><label>草稿<textarea value={draft} onChange={e=>setDraft(e.target.value)} /></label><p>发送次数：<output>{sends}</output></p></main></I18nProvider>}
createRoot(document.getElementById('preview-root')!).render(<Preview/>);
