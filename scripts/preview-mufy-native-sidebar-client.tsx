/** Real renderer, public-only staged data. No account, model or database. */
import { useState,useRef } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../src/i18n/client";
import { zh } from "../src/i18n/zh";
import {appendComposerDraft} from '../src/lib/opening/composer-fill';
import { MufyNativeImageSidebar } from "../src/components/chat/MufyNativeImageSidebar";
import {MufyCloudMusic} from '../src/components/chat/MufyCloudMusic';
import {MufyImageIsland} from '../src/components/chat/MufyImageIsland';
import image35Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/35/native-image-island/sidebar-spec.json';
import {MufyCommandDrawer} from '../src/components/chat/MufyCommandDrawer';
import {MufyHaloToolkit} from '../src/components/chat/MufyHaloToolkit';
import halo49Data from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/49/native-toolkit/toolkit-data.json';
import static41Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/41/native-static-music/sidebar-spec.json';
import heart41Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/41/native-heart-navigation/sidebar-spec.json';
import commandSpec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/21/native-command-drawer/sidebar-spec.json';
import controlsSpec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/21/native-page-controls/sidebar-spec.json';
import controls26Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/26/native-page-controls/sidebar-spec.json';
import quick22Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/22/native-quick-symbols/sidebar-spec.json';
import island22Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/22/native-island-music/sidebar-spec.json';
import island43Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/43/native-multimodule-island/sidebar-spec.json';
import narrow43Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/43/native-narrow-navigation/sidebar-spec.json';
import capsule22Spec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/22/native-capsule/sidebar-spec.json';
import {MufySourceControls} from '../src/components/chat/MufySourceControls';
import cloudMusicSpec from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/46/native-cloud-music/sidebar-spec.json';
import spec from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/47/native-sidebar/sidebar-spec.json";
import musicSpec from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/48/native-music/sidebar-spec.json";
import pixelMusicSpec from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/34/native-pixel-music/sidebar-spec.json";
import blackSidebarSpec from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/44/native-black-sidebar/sidebar-spec.json";
import insMusicSpec from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/45/native-ins-music/sidebar-spec.json";
import zenMusicSpec from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/38/native-zen-music/sidebar-spec.json";
import type { NativeImageSidebar } from "../src/lib/opening/native-image-sidebar";
import {applyHaloCommands,type HaloCommandState} from '../src/lib/opening/halo-toolkit';

const params=new URLSearchParams(location.search);
const sourceSpec=(params.has('image35')?image35Spec:params.has('narrow43')?narrow43Spec:params.has('island43')?island43Spec:params.has('controls26')?controls26Spec:params.has('heart41')?heart41Spec:params.has('static41')?static41Spec:params.has('capsule22')?capsule22Spec:params.has('island22')?island22Spec:params.has('quick22')?quick22Spec:params.has('controls')?controlsSpec:params.has('commands')?commandSpec:params.has('cloud')?cloudMusicSpec:params.has('zen')?zenMusicSpec:params.has('ins')?insMusicSpec:params.has('black')?blackSidebarSpec:params.has('pixel')?pixelMusicSpec:params.has('music')?musicSpec:spec) as NativeImageSidebar;
// Optional synthetic test control. Candidate/source files are not modified.
// Triggering a parent update from inside the opaque frame avoids confusing an
// ordinary outside click (which should close a focus drawer) with a rerender.
const previewSpec=params.has('in-frame-repaint')?{...sourceSpec,documents:sourceSpec.documents.map((doc,index)=>index===0?doc.replace('</body>','<button id="fixture-parent-repaint" style="position:fixed;bottom:0;left:0;z-index:999" onclick="window.host.fillComposer(\'fixture:parent-repaint\')">本地回归：无焦点切换重绘</button></body>'):doc)}:sourceSpec;

function Preview() {
  const inputRef=useRef<HTMLTextAreaElement|null>(null);
  const [haloSelection,setHaloSelection]=useState<HaloCommandState|null>(null),[haloSendPreview,setHaloSendPreview]=useState('');
  const [draft, setDraft] = useState(""),
    [renders, setRenders] = useState(0),
    [open, setOpen] = useState(false),
    [sendAttempts, setSendAttempts] = useState(0);
  return (
    <I18nProvider locale="zh-TW" dict={zh}>
      <main>
        <h1>侧栏组件验收 · 本地未发布</h1>
        <p>
          使用原始公开组件，仅作本地隔离验收，尚未发布。
        </p>
        <button type="button" onMouseDown={(event)=>event.preventDefault()} onClick={() => setRenders((value) => value + 1)}>
          模拟回复重绘
        </button>
        <p>
          重绘次数：<output id="preview-render-count">{renders}</output>
        </p>
        <p>
          侧栏：
          <output id="preview-open-state">{open ? "已展开" : "已收起"}</output>
        </p>
        <label>
          复制动作落到此处（不发送）
          <textarea
            id={params.has('island43')?'nj_chat_input_textarea':'preview-composer'}
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <p>
          发送回调次数：<output id="preview-send-count">{sendAttempts}</output>
        </p>
        {params.has('halo49')&&<><button type="button" onClick={()=>setHaloSendPreview(applyHaloCommands(draft,haloSelection))}>本地检查发送前文本（不发送）</button><pre id="preview-halo-send-text" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{haloSendPreview}</pre></>}
      </main>
      {(sourceSpec.variant==='cloud-music'||sourceSpec.variant==='page-controls')&&<div id="nj_chat_messages" style={{position:'fixed',left:16,top:16,width:280,height:130,overflowY:'auto',border:'1px solid var(--accent-primary)'}}><div style={{height:1200,display:'flex',flexDirection:'column',justifyContent:'space-between'}}><span>顶端检查点</span>{sourceSpec.pageControls?.navigation==='capsule'&&<><div className="nj_ai_message_bubble">江峙 · 第一条公开测试消息<p dir="auto">江峙 · 嵌套段落不得重复计数</p></div><p dir="auto">江峙 · 第二条独立测试段落</p><div className="nj_user_message_bubble">江峙 · 第三条测试消息</div></>}<span>底端检查点</span></div></div>}
      {sourceSpec.variant==='image-island'?<MufyImageIsland spec={sourceSpec} onOpenChange={setOpen}/>:params.has('halo49')?<MufyHaloToolkit data={halo49Data} onCommandChange={setHaloSelection} onFillComposer={text=>setDraft(value=>value+(value?'\n':'')+text)} onOpenChange={setOpen}/>:sourceSpec.variant==='page-controls'?<MufySourceControls spec={sourceSpec} inputRef={inputRef} onChange={setDraft}/>:sourceSpec.variant==='command-drawer'?<MufyCommandDrawer spec={sourceSpec} characterId="command-local-fixture" onFillComposer={setDraft} onOpenChange={setOpen}/>:sourceSpec.variant==='cloud-music'?<MufyCloudMusic spec={sourceSpec} characterId="cloud-local-fixture" onReplaceComposer={setDraft} onOpenChange={setOpen}/>:<MufyNativeImageSidebar
        spec={previewSpec}
        widgetKey="preview-47"
        character={{
          id: "preview-47",
          name: "卓序生",
          avatarUrl: null,
          bio: null,
          tags: [],
        }}
        userName="测试玩家"
        history={[]}
        onFillComposer={(text,options)=>text==='fixture:parent-repaint'?setRenders(value=>value+1):setDraft(value=>appendComposerDraft(value,text,options))}
        onSendMessage={() => setSendAttempts((value) => value + 1)}
        onOpenChange={setOpen}
      />}
    </I18nProvider>
  );
}
createRoot(document.getElementById("preview-root")!).render(<Preview />);
