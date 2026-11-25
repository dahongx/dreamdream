import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {savedReplyFrameInventory} from '../mufy-saved-reply-ui-check.mjs';
test('three identically titled artifacts get distinct grounded DOM paths, not ambiguous title selectors',()=>{
 const dom=new JSDOM('<main id="nj_chat_messages"><section><iframe title="互动内容"></iframe></section><section><div><iframe title="互动内容"></iframe><iframe title="互动内容"></iframe></div></section></main>');
 const doc=dom.window.document,frames=Array.from(doc.querySelectorAll('iframe')),rows=savedReplyFrameInventory(frames);
 expect(new Set(rows.map((row:{selector:string})=>row.selector)).size).toBe(3);
 rows.forEach((row:{selector:string},i:number)=>expect(doc.querySelector(row.selector)).toBe(frames[i]));dom.window.close();
});
test('unique public titles retain a shadow-piercing locator and ambiguous frames outside root fail closed',()=>{
 const dom=new JSDOM('<iframe title="unique-public"></iframe>');
 expect(savedReplyFrameInventory(Array.from(dom.window.document.querySelectorAll('iframe')))[0].selector).toBe('iframe[title="unique-public"]');
 dom.window.document.body.insertAdjacentHTML('beforeend','<iframe title="unique-public"></iframe>');expect(()=>savedReplyFrameInventory(Array.from(dom.window.document.querySelectorAll('iframe')))).toThrow('AMBIGUOUS_FRAME_OUTSIDE_KNOWN_PUBLIC_ROOT');dom.window.close();
});
