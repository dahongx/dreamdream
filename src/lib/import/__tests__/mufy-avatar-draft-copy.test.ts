import {expect,test} from 'bun:test';
import {adaptMufyAvatarDraftCopy} from '../mufy-avatar-draft-copy';
const handler="navigator.clipboard.writeText(this.src);alert('Image Link Copied!')";
test('known public avatar actions preserve source URLs and everything outside handlers',()=>{
 const input='<style>.avatar{border-radius:50%}</style>'+[1,2].map(n=>`<img class="avatar" src="https://example.com/${n}.png" onclick="${handler}">`).join('');
 expect(()=>adaptMufyAvatarDraftCopy(input)).toThrow('AVATAR_CLIPBOARD_SEMANTICS_MUST_BE_PRESERVED');
 const out=adaptMufyAvatarDraftCopy(input,{historicalAuditOnly:true});
 expect(out.adapted).toBe(2);expect(out.html).toContain('https://example.com/1.png');expect(out.html).toContain('https://example.com/2.png');
 expect(out.html.replaceAll("window.host.fillComposer(this.src);alert('已填入草稿，请确认后发送。')",handler)).toBe(input);
 expect(out.html).not.toContain('sendMessage');expect(adaptMufyAvatarDraftCopy(out.html)).toEqual({html:out.html,adapted:0});
});
test('unknown clipboard uses remain untouched and mismatched exact source actions require review',()=>{
 const other='<button onclick="navigator.clipboard.readText()">other</button>';
 expect(adaptMufyAvatarDraftCopy(other)).toEqual({html:other,adapted:0});
 expect(()=>adaptMufyAvatarDraftCopy(`<button onclick="${handler}">bad</button>`,{historicalAuditOnly:true})).toThrow('PUBLIC_AVATAR_COPY_BOUNDARY_CHANGED');
 expect(()=>adaptMufyAvatarDraftCopy(`<img src="javascript:bad()" onclick="${handler}">`,{historicalAuditOnly:true})).toThrow('PUBLIC_AVATAR_COPY_BOUNDARY_CHANGED');
});
