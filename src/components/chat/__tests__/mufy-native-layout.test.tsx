import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {renderToStaticMarkup} from 'react-dom/server';
import {MessageRenderer} from '../MessageRenderer';
import {MufySharedComponentStyleContext,MufyOriginalTitleFontContext} from '../mufy-shared-component-context';

const source='<div style="max-width:900px;margin:auto"><details><summary>状态</summary>A</details><details><summary>手机</summary>B</details></div><details><summary>记忆</summary>C</details>';
test('source fenced artifacts can shrink below the native 240px minimum',()=>{
 const fenced='```html\n<details><summary>状态</summary>内容</details>\n```';
 const sourceHtml=renderToStaticMarkup(<MessageRenderer source={fenced} mufySourceDefaults/>);
 expect(sourceHtml).toContain('min-height:1px');
 expect(renderToStaticMarkup(<MessageRenderer source={fenced}/>)).toContain('min-height:240px');
});
test('original title font is opt-in and cannot change ordinary card rendering',()=>{
 const title='<details><summary><div class="censy-quad-title">𐙚₊˚那你发誓⊹꙳</div></summary>内容</details>';
 const opted=renderToStaticMarkup(<MufyOriginalTitleFontContext.Provider value={true}><MessageRenderer source={title} mufySourceDefaults/></MufyOriginalTitleFontContext.Provider>);
 expect(opted).toContain('data-mufy-original-title-font="qie-51271b"');
 expect(opted).toContain('𐙚₊˚那你发誓⊹꙳');
 expect(renderToStaticMarkup(<MessageRenderer source={title} mufySourceDefaults/>)).not.toContain('data-mufy-original-title-font=');
 expect(renderToStaticMarkup(<MufyOriginalTitleFontContext.Provider value={true}><MessageRenderer source={title}/></MufyOriginalTitleFontContext.Provider>)).not.toContain('data-mufy-original-title-font=');
});
test('native imported siblings share a full-width block instead of becoming separate flex items',()=>{
 const html=renderToStaticMarkup(<MessageRenderer source={source} mufySourceDefaults />);
 expect(html).toMatch(/^<div[^>]*data-character-css="mufy-native-message"/);
 expect(html.match(/<details/g)?.length).toBe(3);
 expect(html).toContain('max-width:900px;margin:auto');
 expect(html.endsWith('</details></div>')).toBe(true);
});
test('ordinary cards keep their existing sibling render path',()=>{
 const html=renderToStaticMarkup(<MessageRenderer source={source}/>);
 expect(html).not.toContain('data-character-css="mufy-native-message"');
});

test('source speech repeats the role avatar without changing ordinary card defaults',()=>{
 const props={source:'<message>你好</message>',mufyAvatar:{src:'https://example.com/avatar.png',name:'角色'}};
 const imported=renderToStaticMarkup(<MessageRenderer {...props} mufySourceDefaults/>);
 expect(imported).toContain('alt="角色"');
 expect(imported).toContain('avatar.png');
 expect(imported).toContain('nj_ai_message_bubble');
 expect(renderToStaticMarkup(<MessageRenderer {...props}/>)).not.toContain('<img');
});
test('creator state skin also reaches old native messages, scoped away from host UI',()=>{
 const css='.m-state-wrapper{width:100%}.m-state-fold summary{color:#A5E0D0;padding:12px 16px;background:rgba(0,0,0,.3)}';
 const html=renderToStaticMarkup(<MufySharedComponentStyleContext.Provider value={css}><MessageRenderer source='<details class="m-state-fold"><summary>状态</summary>内容</details>' mufySourceDefaults/></MufySharedComponentStyleContext.Provider>);
 expect(html).toContain('[data-character-css="mufy-native-message"] .m-state-fold summary');
 expect(html).toContain('#A5E0D0');
 expect(html).toContain('12px 16px');
});
test('binds the imported opening player in visible text without changing code, links or native messages', () => {
 const source = '<p data-name="mufyer">{{ user }}，mufyer，你好</p><details><summary>mufyer的状态</summary></details><code>mufyer</code><a rel="author" href="/mufyer">mufyer</a>';
 const playerName = '甲<玩家>$&';
 const doc = new JSDOM(renderToStaticMarkup(<MessageRenderer source={source} mufySourceDefaults mufyOpeningPlayerName={playerName}/>)).window.document;
 expect(doc.querySelector('p')?.textContent).toBe(`${playerName}，${playerName}，你好`);
 expect(doc.querySelector('p')?.getAttribute('data-name')).toBe('mufyer');
 expect(doc.querySelector('summary')?.textContent).toBe(`${playerName}的状态`);
 expect(doc.querySelector('code')?.textContent).toBe('mufyer');
 expect(doc.querySelector('a')?.getAttribute('href')).toBe('/mufyer');
 expect(doc.querySelector('a')?.textContent).toBe('mufyer');
 expect(renderToStaticMarkup(<MessageRenderer source={source} mufyOpeningPlayerName={playerName}/>)).not.toContain('甲');
 expect(renderToStaticMarkup(<MessageRenderer source={source} mufySourceDefaults/>)).not.toContain('甲');
});
