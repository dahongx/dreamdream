import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {FloatingSlot} from '../src/components/chat/FloatingSlot';
import source from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/30/native-meme/source-program.json';
import instructions from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/23/native-instructions/source-program.json';
import ornament from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/24/native-ornament/source-program.json';
const isInstructions=new URLSearchParams(location.search).has('instructions');
const isOrnament=new URLSearchParams(location.search).has('ornament');
const components=[{id:'public-meme',packId:'fixture',name:'public drawer',content:(isOrnament?ornament:isInstructions?instructions:source).content,enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}];
function Preview(){const[n,setN]=useState(0);return <I18nProvider locale="zh-TW" dict={zh}><main><h1>{isOrnament?'原生挂件':isInstructions?'指令侧栏':'表情库'} · 本地未发布</h1><p>原站公开内容和样式；无模型调用。</p><button onClick={()=>setN(n+1)}>模拟回复重绘</button><output>{n}</output><label>输入框<textarea/></label><FloatingSlot components={components} character={{id:'fixture',name:'Fixture',avatarUrl:null,tags:[],bio:null}} userName="Fixture" onSendMessage={()=>{}}/></main></I18nProvider>}
createRoot(document.getElementById('preview-root')!).render(<Preview/>);
