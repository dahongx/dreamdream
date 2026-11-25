import {useCallback,useLayoutEffect,useMemo,useRef,useState,type SyntheticEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
import {ToastProvider} from '../src/components/ui/ToastProvider';
import {DialogProvider} from '../src/components/ui/DialogProvider';
import {MessageBubble} from '../src/components/chat/MessageBubble';
import {MufyNativeSourceContext} from '../src/components/chat/mufy-shared-component-context';
import type {RegexRule} from '../src/lib/db/schema';
import fixture from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/saved-reply-preview/fixtures.json';
function App(){
 const params=new URLSearchParams(location.search),rank=Number(params.get('rank')??35),round=Number(params.get('round')??2),entry=fixture.cases.find(row=>row.rank===rank&&row.round===round);
 const [repaints,setRepaints]=useState(0),[sends,setSends]=useState(0),[draft,setDraft]=useState('');
 const main=useRef<HTMLElement|null>(null),loadedFrames=useRef(new WeakSet<HTMLIFrameElement>()),[layoutStable,setLayoutStable]=useState(false),[pendingFrameCount,setPendingFrameCount]=useState(0);
 const captureFrameLoad=useCallback((event:SyntheticEvent)=>{if(event.target instanceof HTMLIFrameElement)loadedFrames.current.add(event.target);},[]);
 useLayoutEffect(()=>{
  const node=main.current;if(!node)return;let live=true,timer:number|undefined,previous='';const pending=new Set<HTMLIFrameElement>(),registered=new Set<HTMLIFrameElement>();
  const geometry=()=>{const rect=node.getBoundingClientRect();return [rect.width,rect.height,node.scrollWidth,node.scrollHeight].join(':');};
  const check=()=>{if(!live)return;const current=geometry();if(pending.size||current!==previous){previous=current;timer=window.setTimeout(check,150);}else setLayoutStable(true);};
  const schedule=()=>{window.clearTimeout(timer);setLayoutStable(false);previous=geometry();timer=window.setTimeout(check,150);};
  const loaded=(event:Event)=>{const child=event.currentTarget as HTMLIFrameElement;loadedFrames.current.add(child);pending.delete(child);setPendingFrameCount(pending.size);schedule();};
  const register=()=>{for(const child of node.querySelectorAll('iframe'))if(!registered.has(child)){registered.add(child);if(!loadedFrames.current.has(child))pending.add(child);child.addEventListener('load',loaded);}setPendingFrameCount(pending.size);schedule();};
  const sizes=new ResizeObserver(schedule),children=new MutationObserver(register);sizes.observe(node);children.observe(node,{childList:true,subtree:true});register();
  return()=>{live=false;window.clearTimeout(timer);sizes.disconnect();children.disconnect();for(const child of registered)child.removeEventListener('load',loaded);};
 },[entry]);
 const onSend=useCallback(()=>setSends(n=>n+1),[]),onFill=useCallback((text:string)=>setDraft(text),[]);
 const rules=useMemo<RegexRule[]>(()=>entry?.rules.map((rule,index)=>({...rule,id:`public-replay-${rank}-${index}`,packId:'local-public-replay',targetText:null,variableMapping:[],outputGuidance:null,createdAt:new Date(0),updatedAt:new Date(0)}))??[],[entry,rank]);
 const message=useMemo(()=>({id:`saved-public-${rank}-${round}`,role:'assistant' as const,parts:[{type:'text' as const,text:entry?.raw??''}]}),[entry,rank,round]);
 const character=useMemo(()=>({id:`public-${rank}`,name:entry?.name??'缺少已保存回复',avatarUrl:null,tags:[],bio:null}),[entry,rank]);
 return <><header><h1>已保存回复回放 · 本地未发布</h1><p>仅检查渲染与控件；第三方媒体、字体、网络均禁用，不是媒体或整卡验收。</p><p id="case-identity" data-rules-sha256={entry?.ruleSetSha256}>{rank} · {entry?.name??'缺少已保存回复'} · 第 {round} 条</p><p>布局：<output id="layout-state" data-state={layoutStable?'stable':'measuring'}>{layoutStable?'已稳定':'测量中'}</output> · 待加载交互框：<output id="pending-frame-count">{pendingFrameCount}</output></p><button onClick={()=>setRepaints(n=>n+1)}>模拟回复重绘</button><output id="repaint-count">{repaints}</output><p>发送回调：<output id="send-count">{sends}</output></p><label>本地草稿（不发送）<textarea value={draft} readOnly/></label></header><main ref={main} id="nj_chat_messages" onLoadCapture={captureFrameLoad}>{entry?<MufyNativeSourceContext.Provider value={true}><MessageBubble message={message} rules={rules} isStreaming={false} isLatestAssistant={true} character={character} userName="验收用户" userAvatarUrl={null} onSendMessage={onSend} onFillComposer={onFill}/></MufyNativeSourceContext.Provider>:<p>未提供已完成回复，不生成替代内容。</p>}</main></>;
}
createRoot(document.getElementById('preview-root')!).render(<I18nProvider locale="zh-TW" dict={zh}><ToastProvider><DialogProvider><App/></DialogProvider></ToastProvider></I18nProvider>);
