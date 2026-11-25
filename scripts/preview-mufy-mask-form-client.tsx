/** Actual public form, real opaque frame, no account/model/database. */
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {OpeningSlot} from '../src/components/chat/OpeningSlot';
import fixture from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/41/mask-form-preview.json';
const components=(location.search.includes('panels')?fixture.panels:[fixture.html]).map((html,index)=>({id:'mask-form-fixture-'+index,packId:'fixture',name:'public source panel',content:html,enabled:true,orderIndex:index,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}));
function Preview(){const[draft,setDraft]=useState(''),[sends,setSends]=useState(0),[paint,setPaint]=useState(0);return <I18nProvider locale="zh-TW" dict={zh}><main><h1>人物面具表单 · 本地未发布</h1><p>公开组件实测；无账号、模型和数据库。</p><button onClick={()=>setPaint(n=>n+1)}>模拟父级重绘</button><output>重绘次数：{paint}</output><OpeningSlot components={components} character={{id:'fixture',name:'Fixture',avatarUrl:null,tags:[],bio:null}} userName="Fixture" onFillComposer={setDraft} onSendMessage={()=>setSends(n=>n+1)}/><label>草稿<textarea value={draft} onChange={e=>setDraft(e.target.value)} /></label><p>发送次数：<output>{sends}</output></p></main></I18nProvider>}
createRoot(document.getElementById('preview-root')!).render(<Preview/>);
