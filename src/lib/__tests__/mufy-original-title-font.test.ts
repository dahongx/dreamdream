import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {usesMufyOriginalTitleFont,MUFY_ORIGINAL_TITLE_FONT_CSS,MUFY_QIE_FONT_SHA256,MUFY_QIE_FONT_PATH} from '../import/mufy-original-title-font';
const url='https://s3plus.meituan.net/opapisdk/op_ticket_1_5677168484_1772019524134_qdqqd_7zgmfh.woff2';
const css=`@font-face{font-family:'CensyCustomTitleFont';src:url('${url}')} .censy-quad-title{font-family:CensyCustomTitleFont,sans-serif}`;
test('only a matching public font declaration and component opt in',()=>{
 expect(usesMufyOriginalTitleFont([{content:`<style>${css}</style>`}])).toBe(true);
 for(const content of [css,`<script>${css}</script>`,`<style>/*${css}*/</style>`,`<style>${css.replace(url,'https://other.example/font.woff2')}</style>`,`<style>${css.replace('.censy-quad-title','.other')}</style>`]) expect(usesMufyOriginalTitleFont([{content}])).toBe(false);
});
test('host CSS uses only pinned local asset and opt-in selector',()=>{
 expect(MUFY_ORIGINAL_TITLE_FONT_CSS).toContain('[data-mufy-original-title-font="qie-51271b"] .censy-quad-title');
 expect(MUFY_ORIGINAL_TITLE_FONT_CSS).not.toContain('https:');
 expect(MUFY_ORIGINAL_TITLE_FONT_CSS).not.toContain('font-size');
});
test('public asset is exactly the verified user-supplied font',async()=>{
 const bytes=await Bun.file(`public${MUFY_QIE_FONT_PATH}`).bytes();
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(MUFY_QIE_FONT_SHA256);
});
