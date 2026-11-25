/** Real public renderers composed together; no ChatRoom transport or account. */
import {useMemo,useRef,useState,useCallback,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {ToastProvider} from '../src/components/ui/ToastProvider';
import {DialogProvider} from '../src/components/ui/DialogProvider';
import {OpeningSlot} from '../src/components/chat/OpeningSlot';
import {FloatingSlot} from '../src/components/chat/FloatingSlot';
import {FloatingLayer} from '../src/components/chat/FloatingLayer';
import {MufySourceControls,uniqueSourceControls} from '../src/components/chat/MufySourceControls';
import {MufyPrefixPanel} from '../src/components/chat/MufyPrefixPanel';
import {MufyHaloToolkit} from '../src/components/chat/MufyHaloToolkit';
import {uniqueComposerPrefix} from '../src/lib/opening/composer-prefix';
import {extractNativeImageSidebars} from '../src/lib/opening/native-image-sidebar';
import fixture from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/candidate-composition-preview/fixtures.json';
function App(){
 const rank=Number(new URLSearchParams(location.search).get('rank')??21),entry=fixture.cases.find(c=>c.rank===rank);
 const [draft,setDraft]=useState(''),[sends,setSends]=useState(0),[renders,setRenders]=useState(0),input=useRef<HTMLTextAreaElement|null>(null);
 const repaintTimer=useRef<ReturnType<typeof setTimeout>|null>(null);useEffect(()=>()=>{if(repaintTimer.current)clearTimeout(repaintTimer.current);},[]);
 const components=useMemo(()=>entry?[{id:'composition-'+rank,packId:'public-qa',name:'已保存公开美化候选',content:entry.content,enabled:true,orderIndex:0,createdAt:new Date(0),updatedAt:new Date(0),slotValues:{}}]:[],[entry,rank]);
 const contents=useMemo(()=>components.map(c=>c.content),[components]),sourceControls=useMemo(()=>uniqueSourceControls(contents),[contents]),prefix=useMemo(()=>uniqueComposerPrefix(contents),[contents]);
 const halos=useMemo(()=>contents.flatMap(c=>extractNativeImageSidebars(c).sidebars).filter(s=>s.variant==='halo-toolkit'),[contents]),halo=halos.length===1?halos[0].haloToolkit:null;
 const character=useMemo(()=>({id:'public-composition-'+rank,name:entry?.name??'缺少候选',avatarUrl:null,bio:null,tags:[]}),[rank,entry]);
 const onSend=useCallback(()=>setSends(n=>n+1),[]),onFill=useCallback((text:string)=>setDraft(value=>value+(value?'\n':'')+text),[]),onPrefix=useCallback(()=>{},[]),onHalo=useCallback(()=>{},[]);
 return <><header><h1>最终候选组合验收 · 本地未发布</h1><p id="case-identity" data-candidate-sha256={entry?.sha256}>{rank} · {entry?.name}</p><p>真实组件组合检查；外部网络、媒体和字体禁用。不是测试服或整卡验收。</p><button id="repaint-button" onClick={()=>setRenders(n=>n+1)}>模拟回复重绘</button><button id="delayed-repaint-button" onClick={()=>{if(repaintTimer.current)clearTimeout(repaintTimer.current);repaintTimer.current=setTimeout(()=>setRenders(n=>n+1),2000);}}>2秒后重绘（随后打开面板，期间不移焦点）</button><output id="repaint-count">{renders}</output><p>发送回调：<output id="send-count">{sends}</output></p></header><main id="nj_chat_messages"><OpeningSlot components={components} character={character} userName="验收用户" onSendMessage={onSend} onFillComposer={onFill}/></main><FloatingLayer><FloatingSlot components={components} character={character} userName="验收用户" onSendMessage={onSend} onFillComposer={onFill} onReplaceComposer={setDraft}/></FloatingLayer><footer id="nj_chat_input_container">{sourceControls&&<MufySourceControls spec={sourceControls} inputRef={input} onChange={setDraft}/>} {halo&&<MufyHaloToolkit scope={'composition-'+rank} data={halo} onFillComposer={onFill} onOpenChange={()=>{}} onCommandChange={onHalo}/>}<div id="nj_chat_input_box">{prefix&&<MufyPrefixPanel spec={prefix} sessionId={'composition-'+rank} onChange={onPrefix}/>}<label>本地草稿（不发送）<textarea id="nj_chat_input_textarea" ref={input} value={draft} onChange={e=>setDraft(e.target.value)}/></label></div></footer></>;
}
createRoot(document.getElementById('preview-root')!).render(<I18nProvider locale="zh-TW" dict={zh}><ToastProvider><DialogProvider><App/></DialogProvider></ToastProvider></I18nProvider>);
