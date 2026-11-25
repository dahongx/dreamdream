import { expect, test } from 'bun:test';
import { MUFY_QUAD_DETAILS_PATTERN, MUFY_AQ_DETAILS_PATTERN, MUFY_AQ_PREMATURE_CLOSE_PATTERN, MUFY_AQ_CLOSE_REPLACEMENT, mufyStatusIndentRules } from '../mufy-status-indent';
import {parseExternalRulesJson} from '../external-card';
import { prepareForMarkdown } from '../../markdown-prep';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {MessageRenderer} from '../../../components/chat/MessageRenderer';

test('repairs only matching status-template indentation and retains its content', () => {
  const source='    <details>\n        <summary><div class="censy-quad-title">状态</div></summary>\n        <div>内容</div>\n    </details>';
  expect(mufyStatusIndentRules([source])).toHaveLength(1);
  const fixed=prepareForMarkdown(source.replace(new RegExp(MUFY_QUAD_DETAILS_PATTERN,'gm'),'$1'));
  expect(fixed).toBe('<details>\n<summary><div class="censy-quad-title">状态</div></summary>\n<div>内容</div>\n</details>');
  expect(mufyStatusIndentRules([fixed])).toEqual([]);
});

test('aq-v2 recovery preserves the outer memory disclosure after a stray earlier end tag',()=>{
 const source='<div class="aq-v2-root">\n<details><summary>状态</summary>正文</details>\n</details>\n    <details class="aq-v2-item">\n         <summary class="aq-v2-title">记忆</summary>\n        <div class="aq-v2-panel"><details><summary>VOL.01</summary>记录</details></div>\n    </details>\n</div>';
 const fixed=source.replace(new RegExp(MUFY_AQ_DETAILS_PATTERN,'gm'),'$1');
 expect(mufyStatusIndentRules([source]).map(r=>r.ruleName)).toContain('迁移兼容：来源状态栏缩进（aq-v2）');
 const doc=new JSDOM(renderToStaticMarkup(createElement(MessageRenderer,{source:fixed,mufySourceDefaults:true}))).window.document;
 const memory=Array.from(doc.querySelectorAll('summary')).find(e=>e.textContent==='记忆')!;
 const archive=Array.from(doc.querySelectorAll('summary')).find(e=>e.textContent==='VOL.01')!;
 expect(memory.parentElement?.tagName).toBe('DETAILS');
 expect(archive.parentElement?.parentElement?.closest('details')).toBe(memory.parentElement);
});

test('known duplicated aq-v2 closures cannot leak BBS content outside its fold',()=>{
 const source='<div class="aq-v2-container"><details class="aq-v2-item"><summary class="aq-v2-title">论坛</summary><div class="aq-v2-panel"><div class="aq-v2-scroll-box">聊天</div></div></details></div>\n<div class="aq-v2-label"><span>✦</span> 校园匿名 BBS</div><div class="aq-v2-forum">帖子</div></div></div></details><details class="aq-v2-item"><summary class="aq-v2-title">记忆</summary>记录</details></div>';
 const fixed=source.replace(new RegExp(MUFY_AQ_PREMATURE_CLOSE_PATTERN,'gm'),MUFY_AQ_CLOSE_REPLACEMENT);
 expect(fixed.replace(/<[^>]+>/g,'')).toBe(source.replace(/<[^>]+>/g,''));
 const doc=new JSDOM(renderToStaticMarkup(createElement(MessageRenderer,{source:fixed,mufySourceDefaults:true}))).window.document;
 expect(doc.querySelector('.aq-v2-forum')?.closest('details')?.querySelector('summary')?.textContent).toBe('论坛');
 expect(doc.querySelectorAll('.aq-v2-container > details')).toHaveLength(2);
 expect(mufyStatusIndentRules([source]).some(r=>r.replaceString===MUFY_AQ_CLOSE_REPLACEMENT)).toBe(true);
 expect(parseExternalRulesJson(JSON.stringify(mufyStatusIndentRules([source]))).ok).toBe(true);
});

test('does not alter ordinary Markdown code or unrelated cards', () => {
  for (const source of ['    <details>\n        sample\n    </details>', '    const x = 1;', '<details><summary>other</summary>body</details>']) {
    expect(mufyStatusIndentRules([source])).toEqual([]);
    expect(source.replace(new RegExp(MUFY_QUAD_DETAILS_PATTERN,'gm'),'$1')).toBe(source);
  }
});
