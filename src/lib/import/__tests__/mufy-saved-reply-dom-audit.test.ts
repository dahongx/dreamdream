import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {collectMufySavedReplyDom} from '../mufy-saved-reply-dom-audit.mjs';

test('a legacy opening frame is not evidence for the latest saved reply',()=>{
 const doc=new JSDOM('<div id="nj_chat_header"><h1>角色</h1></div><div id="nj_chat_messages"><iframe title="regex-old-opening"></iframe><div class="nj_user_message_bubble">第一问</div><iframe title="regex-first-answer"></iframe><div class="nj_user_message_bubble">第二问</div><p>第二次真实回复</p><details><summary>当前状态</summary></details></div>').window.document;
 const result=collectMufySavedReplyDom(doc);
 expect(result.hasSavedUserMessage).toBe(true);
 expect(result.replyFrames).toEqual([]);
 expect(result.replySummaryLabels).toEqual(['当前状态']);
 expect(result.ordinaryReplyTextStart).toBe('第二次真实回复');
 expect(result.fullFidelityAccepted).toBe(false);
});
test('only frames after the last real user bubble are selected; an opening-only page cannot pass',()=>{
 const doc=new JSDOM('<div id="nj_chat_messages"><iframe title="regex-opening"></iframe><div class="nj_user_message_bubble">你好</div><iframe title="regex-current"></iframe></div>').window.document;
 expect(collectMufySavedReplyDom(doc).replyFrames.map((r:{title:string})=>r.title)).toEqual(['regex-current']);
 const opening=new JSDOM('<div id="nj_chat_messages"><iframe title="regex-opening"></iframe></div>').window.document;
 expect(collectMufySavedReplyDom(opening).hasSavedUserMessage).toBe(false);
 expect(collectMufySavedReplyDom(opening).replyFrames).toEqual([]);
});
test('native div narration and whitespace-only paragraphs are handled without reusing old narration',()=>{
 const doc=new JSDOM('<div id="nj_chat_messages"><div data-character-css="mufy-native-message">旧回复</div><div class="nj_user_message_bubble">新问题</div><div data-character-css="mufy-native-message"><p>   </p><div>新回复正文</div></div></div>').window.document;
 const result=collectMufySavedReplyDom(doc);
 expect(result.nativeReplyTextStart).toBe('新回复正文');
 expect(result.ordinaryReplyTextStart).toBe('');
});
test('nested memory folds are not treated as visible top-level status controls',()=>{
 const doc=new JSDOM('<div id="nj_chat_messages"><div class="nj_user_message_bubble">你好</div><details><summary>状态</summary></details><details><summary>记忆</summary><details><summary>短期记录</summary></details></details></div>').window.document;
 const result=collectMufySavedReplyDom(doc);
 expect(result.replySummaryLabels).toEqual(['状态','记忆','短期记录']);
 expect(result.topLevelReplySummaryLabels).toEqual(['状态','记忆']);
});
test('orphan latest-reply summaries are flagged instead of passing a fake open=false check',()=>{
 const doc=new JSDOM('<div id="nj_chat_messages"><div><summary>开场装饰</summary></div><div class="nj_user_message_bubble">你好</div><div><summary>失效的记忆</summary></div></div>').window.document;
 expect(collectMufySavedReplyDom(doc).invalidSummaryParents).toEqual([{label:'失效的记忆',parentTag:'DIV'}]);
});
