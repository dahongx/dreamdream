import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MufyComposerCompanion} from '../src/components/chat/MufyComposerCompanion';
import source from '../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/24/composer-companion/source-program.json';
function Preview(){
 const [draft,setDraft]=useState(''),[renders,setRenders]=useState(0);
 return <main><h1>输入框挂件 · 本地未发布</h1><p>仅真实组件与公开挂件程序，不连接账号、聊天模型或数据库。</p>
 <button type="button" onClick={()=>setRenders(value=>value+1)}>模拟回复重绘</button><p>重绘次数：<output id="preview-renders">{renders}</output></p>
 <div className="preview-controls"><button type="button" id="nj_header_message_btn">消息</button><button type="button" id="nj_header_follow_btn">关注</button><button type="button" id="nj_chat_input_replay_btn">重说</button><button type="button" id="nj_chat_input_model_btn">选择模型</button><button type="button" id="nj_message_actions_delete">删除演示</button><button type="button" id="nj_message_actions_copy">复制演示</button><button type="button" id="nj_message_actions_btn">更多</button></div>
 <label>立绘亮度<input type="range" className="nj_stage_adjust_brightness" min="0" max="100" defaultValue="50" /></label>
 <div role="dialog" data-state="open" aria-label="保存动作演示"><button type="button">保存演示</button></div>
 <div id="nj_chat_input_box"><label>演示输入框<textarea value={draft} onChange={event=>setDraft(event.target.value)} /></label></div>
 <MufyComposerCompanion contents={[source.content]} />
 </main>;
}
createRoot(document.getElementById('preview-root')!).render(<Preview/>);
