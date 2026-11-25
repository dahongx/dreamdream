/** Real opening renderer, exact public source program; no account, model or DB. */
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {OpeningSlot} from '../src/components/chat/OpeningSlot';
import {fullscreenStoryEnvelope,type FullscreenStory} from '../src/lib/opening/fullscreen-story';
import spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/43/fullscreen-story/story-spec.json';
import profileSpec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/46/fullscreen-profile/profile-spec.json';
import timelineSpec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/41/public-timeline/timeline-spec.json';
const selectedSpec=new URLSearchParams(location.search).has('timeline41')?timelineSpec:new URLSearchParams(location.search).has('profile46')?profileSpec:spec;
const components=[{id:'fullscreen-story-fixture',packId:'fixture',name:'public story',content:fullscreenStoryEnvelope(selectedSpec as FullscreenStory),enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}];
function Preview(){const[renders,setRenders]=useState(0),[sends,setSends]=useState(0);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);return <I18nProvider locale="zh-TW" dict={zh}><main><h1>全屏人物动效 · 本地未发布</h1><p>原始公开程序，原图与原时间线。没有账号、模型或数据库。</p><button onClick={()=>setRenders(n=>n+1)}>模拟父级重绘</button><button onClick={()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setRenders(n=>n+1),3000);}}>3 秒后模拟父级重绘</button><output>重绘次数：{renders}</output><OpeningSlot components={components} character={{id:'fixture',name:'沈砚',avatarUrl:null,tags:[],bio:null}} userName="Fixture" onSendMessage={()=>setSends(n=>n+1)}/><label>关闭后检查输入<textarea placeholder="仅测试焦点，不发送"/></label><p>发送次数：<output>{sends}</output></p></main></I18nProvider>}
createRoot(document.getElementById('preview-root')!).render(<Preview/>);
