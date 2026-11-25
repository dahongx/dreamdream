import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {OpeningSlot} from '../src/components/chat/OpeningSlot';
declare const __PUBLIC_FRAME__:string;
const components=[{id:'public-title-fixture',packId:'fixture',name:'Public Song title',content:__PUBLIC_FRAME__,enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}];
createRoot(document.getElementById('root')!).render(<I18nProvider locale="zh-TW" dict={zh}><main><h1>宋锦琛 · 标题边界修复 · 本地未保存</h1><p>真实 OpeningSlot / RegexIframe；无模型、账号或数据库。外部网络关闭。</p><OpeningSlot components={components} character={{id:'fixture',name:'宋锦琛',avatarUrl:null,tags:[],bio:null}} userName="test" onSendMessage={()=>{throw Error('SEND_FORBIDDEN');}}/></main></I18nProvider>);
