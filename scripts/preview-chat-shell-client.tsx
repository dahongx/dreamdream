/** Local production-ChatStage regression, no account or remote requests. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ChatStage} from '../src/components/chat/ChatStage';
import {sanitizeAndScopeCss} from '../src/lib/styling/whitelist';
import {closeStyleBlockAtEof} from '../src/lib/styling/style-block-boundary';
const sourceSheets = ['.unused{overflow-x:hidden; /* broken tail', ':root{--input-box-bg:rgba(0,0,0,.2);--backdrop-blur-radius:12px} #nj_chat_header{background:transparent!important;backdrop-filter:blur(var(--backdrop-blur-radius))!important} #nj_chat_input_container{background:transparent!important;border:none!important} #nj_chat_input_box{background:var(--input-box-bg)!important;backdrop-filter:blur(var(--backdrop-blur-radius))!important} #nj_chat_input_replay_btn{background:#630a10!important;border:1px solid #e0cba0!important;border-radius:8px!important;width:32px}'];
function Fixture({fixed}:{fixed:boolean}) {
  const scope=fixed?'fixed':'before';
  const css=sanitizeAndScopeCss(fixed?sourceSheets.map(closeStyleBlockAtEof).join('\n'):sourceSheets.join('\n'),scope).css;
  return <article data-character-css={scope}><h2>{fixed?'修复后':'旧链路复现'}</h2><style>{css}</style><ChatStage sourcePresentation={fixed} stageBg={null} header={<strong>角色顶部栏 · 透明美化</strong>} messages={<p>生产 ChatStage 布局测试<br/>无远程图片、无模型生成、无数据库。<br/>输入区使用已实测来源规则片段，不代表真实角色卡已验收。</p>} input={<form id="nj_chat_input_container"><div className="toolbar"><button id="nj_chat_input_replay_btn" type="button">↻</button><button id="nj_mask_btn" type="button">面具</button><button id="nj_chat_input_model_btn" type="button">Sonnet 4.6 ▾</button><button id="nj_currency_switcher" type="button">银 2</button></div><div id="nj_chat_input_box"><textarea aria-label={scope+' 输入框'} placeholder="继续对话…"/></div></form>}/></article>;
}
createRoot(document.getElementById('app')!).render(<><h1>聊天外壳回归 · 本地未上线</h1><main><Fixture fixed={false}/><Fixture fixed/></main></>);
