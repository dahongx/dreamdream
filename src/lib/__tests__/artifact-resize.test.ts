import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { wrapBareSrcdoc } from '../regex/iframe-bridge';

test('bare artifact height shrinks after details close, independent of the old iframe viewport', () => {
  const html = wrapBareSrcdoc('<details><summary>State</summary><p>Body</p></details>');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const d = dom.window.document;
  let height = 954;
  const reported: number[] = [];
  let resize: (() => void) | undefined;
  Object.defineProperty(d.documentElement, 'scrollHeight', { get: () => 954 });
  Object.defineProperty(d.body, 'scrollHeight', { get: () => height });
  Object.defineProperty(d.body, 'offsetHeight', { get: () => height });
  d.body.getBoundingClientRect = () => ({ height, width: 358, x: 0, y: 0, top: 0, left: 0, right: 358, bottom: height, toJSON: () => ({}) });
  Object.defineProperty(dom.window, 'parent', { value: { postMessage: (data: { height: number }) => reported.push(data.height) } });
  Object.defineProperty(dom.window, 'ResizeObserver', { value: class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
  } });
  const script = [...d.scripts].find(s => s.textContent?.includes('function measure()'))!;
  dom.window.eval(script.textContent!);
  d.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  expect(reported.at(-1)).toBe(954);
  height = 163;
  resize!();
  expect(reported.at(-1)).toBe(163);
  dom.window.close();
});

test('bare artifact sizing keeps sandbox CSP and does not rewrite authored colors', () => {
  const html = wrapBareSrcdoc('<div style="background:red;color:white">State</div>');
  expect(html).toContain("connect-src 'none'");
  expect(html).toContain("frame-src 'none'");
  expect(html).toContain('background:red;color:white');
});

test('sizing marker does not swallow authored body classes in full HTML documents', () => {
  const dom = new JSDOM(wrapBareSrcdoc('<html><body class="author-theme"><p>State</p></body></html>'));
  expect(dom.window.document.body.classList.contains('author-theme')).toBe(true);
  expect(dom.window.document.body.hasAttribute('data-nj-artifact-canvas')).toBe(true);
  dom.window.close();
});
