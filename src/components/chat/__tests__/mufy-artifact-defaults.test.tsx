import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { MessageRenderer } from '../MessageRenderer';

test('both imported artifact routes inherit public defaults while native documents stay unchanged', () => {
  for (const source of ['```html\n<p>公开正文</p>\n```', '<artifact><p>公开正文</p></artifact>']) {
    for (const imported of [false,true]) {
      const rendered = new JSDOM(renderToStaticMarkup(<MessageRenderer source={source} mufySourceDefaults={imported}/>));
      try {
        const srcdoc = rendered.window.document.querySelector('iframe')?.getAttribute('srcdoc');
        expect(srcdoc).toBeDefined();
        expect(srcdoc?.includes('data-nj-mufy-document-defaults')).toBe(imported);
        expect(srcdoc).not.toContain('font-family:"Noto Sans SC"!important');
        expect(srcdoc).not.toContain('allow-same-origin');
      } finally {rendered.window.close();}
    }
  }
});
