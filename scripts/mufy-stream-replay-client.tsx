/** Local-only synthetic regression UI using the actual production component.
 * No API/model request, credential, storage or database access. */
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {RegexIframe} from '../src/components/regex/RegexIframe';
import {I18nProvider} from '../src/i18n/client';
import {zh} from '../src/i18n/zh';
const character={id:'synthetic-stream-regression',name:'流式回放',avatarUrl:null,tags:[],bio:null};
const onSend=()=>{};
function Replay(){
 const [mode,setMode]=useState<'baseline'|'fixed'>('fixed'),[chunk,setChunk]=useState(0),[running,setRunning]=useState(false),[loads,setLoads]=useState(0),[applied,setApplied]=useState(0),[css,setCss]=useState('');
 const area=useRef<HTMLDivElement>(null);
 useEffect(()=>{fetch('/public-style.json').then(r=>r.json()).then(d=>setCss(d.css));},[]);
 useEffect(()=>{if(!running)return;const t=setInterval(()=>setChunk(n=>{if(n>=80){setRunning(false);return n;}return n+1;}),120);return()=>clearInterval(t);},[running]);
 useEffect(()=>{const frame=area.current?.querySelector('iframe');const loaded=()=>setLoads(n=>n+1);const updated=(e:MessageEvent)=>{if(e.source===frame?.contentWindow&&e.data?.type==='nj-mufy-stream-applied')setApplied(n=>n+1);};frame?.addEventListener('load',loaded);window.addEventListener('message',updated);return()=>{frame?.removeEventListener('load',loaded);window.removeEventListener('message',updated);};},[mode,!!css]);
 const content=`<style data-mufy-source-skin>${css}summary{animation:replayEntry .25s both}@keyframes replayEntry{from{opacity:0}to{opacity:1}}</style><div class="mufy-source-canvas"><div class="m-state-wrapper"><details class="m-state-fold" id="state"><summary>【 躯壳与心念 】</summary><div class="m-state-content">展开状态必须在新增文字时保留。</div></details><details class="m-state-fold"><summary>【 诸相与因果 】</summary><div class="m-state-content">事件监听与样式不能重启。</div></details></div><p id="stream-text">${'风满楼抬起眼，等你继续说下去。'.repeat(Math.ceil(chunk/5)).slice(0,chunk*3)}</p>${chunk>=50?'<details id="memory"><summary>【 记忆与誓约 】</summary><p>后出现的完整组件也应正常。</p></details>':''}</div>`;
 function start(next:'baseline'|'fixed'){setRunning(false);setMode(next);setChunk(0);setLoads(0);setApplied(0);setRunning(true);}
 return <main><h1>流式组件动态回放（合成样例，不是线上聊天）</h1><p>生产 RegexIframe，120ms 一段；人工观察标题与展开状态。</p><button onClick={()=>start('baseline')}>回放原逻辑</button><button onClick={()=>start('fixed')}>回放修复逻辑</button><button onClick={()=>setRunning(v=>!v)}>{running?'暂停':'继续'}</button><output data-metrics>{JSON.stringify({mode,chunk,running,loads,applied})}</output><div ref={area} style={{maxWidth:640,margin:'20px auto'}}>{css&&<RegexIframe key={mode} ruleId="stream-replay" ruleName="synthetic-stream-replay" srcdoc={content} captureGroups={[]} incrementalUpdates={mode==='fixed'} character={character} userName="测试用户" onSendMessage={onSend} minHeight={1}/>}</div></main>;
}
createRoot(document.getElementById('app')!).render(<I18nProvider locale="zh" dict={zh}><Replay/></I18nProvider>);
