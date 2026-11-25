import { expect, test } from 'bun:test';
import { openingComponentPresentation } from '../import/mufy-component-presentation';
import { buildIframeSrcdoc, PLATFORM_RESET_STYLE_TAG } from '../regex/iframe-bridge';
import { readFileSync } from 'node:fs';

const host = '[data-character-css="opening"]{color:gold!important;text-shadow:0 1px 3px black!important}';
const author = '<style>.panel{background:#eee;color:#222}body{color:#888}</style><div class="panel">Example</div>';

test('independent imported component keeps author CSS without host theme leakage', () => {
  const result = openingComponentPresentation(author, host, true);
  expect(result).not.toContain(host);
  expect(result.endsWith(author)).toBe(true);
  expect(result).toContain('body{color:rgb(0,0,0);text-shadow:none}');
  expect(result).not.toContain('!important');
});
test('ordinary components keep the previous theme injection exactly', () => {
  expect(openingComponentPresentation(author, host, false)).toBe(`<style>${host}</style>\n${author}`);
  expect(openingComponentPresentation(author, '', false)).toBe(`\n${author}`);
});
test('source reply canvases still receive their required host skin', () => {
  for (const marker of ['data-mufy-source-skin', 'data-mufy-rendered-opening']) {
    const source = `<style ${marker}></style>${author}`;
    expect(openingComponentPresentation(source, host, true)).toBe(`<style>${host}</style>\n${source}`);
  }
});
test('isolated components retain sandbox bridge and existing transparent canvas reset', () => {
  const srcdoc = openingComponentPresentation(author, host, true);
  const built = buildIframeSrcdoc({ srcdoc, captureGroups: [], cssScope: 'opening' });
  expect(built).toContain(PLATFORM_RESET_STYLE_TAG);
  expect(built).toContain("connect-src 'none'");
  expect(built).toContain('data-character-css="opening"');
  expect(built.indexOf(PLATFORM_RESET_STYLE_TAG)).toBeLessThan(built.indexOf('data-mufy-component-presentation'));
  expect(built.indexOf('data-mufy-component-presentation')).toBeLessThan(built.indexOf('.panel{'));
});

test('captured fixed profile keeps its author program and 380px content viewport', () => {
  const source = readFileSync('logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/40/target-profile-public-srcdoc-20261105.html', 'utf8');
  const fixed = openingComponentPresentation(source, '', true);
  const blocks = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'))].map(m => m[0]);
  expect(blocks(fixed, 'script')).toEqual(blocks(source, 'script'));
  const author = (html: string) => blocks(html, 'style').filter(s => !s.includes('data-mufy-adaptation="mobile-box-model"') && !s.includes('data-mufy-component-presentation'));
  expect(author(fixed)).toEqual(author(source));
  expect(fixed).toContain('height: 380px;');
  expect(fixed).toContain('html,body{box-sizing:border-box}');
  expect(fixed).not.toContain('*,*::before,*::after{box-sizing:border-box}');
  expect(openingComponentPresentation(source, '', false)).toBe('\n' + source);
  const unrelated = source.replaceAll('char-intro-panel', 'unrelated-panel');
  expect(openingComponentPresentation(unrelated, '', true)).not.toContain('*,*::before,*::after{box-sizing:border-box}');
});

test('captured companion profiles retain their padded content height when expanded', () => {
  const source = readFileSync('logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/40/target-companion-public-srcdoc-20261106.html', 'utf8');
  const fixed = openingComponentPresentation(source, '', true);
  const blocks = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'))].map(m => m[0]);
  expect(blocks(fixed, 'script')).toEqual(blocks(source, 'script'));
  const authorStyles = (html: string) => blocks(html, 'style').filter(s => !s.includes('data-mufy-adaptation="mobile-box-model"') && !s.includes('data-mufy-component-presentation'));
  expect(authorStyles(fixed)).toEqual(authorStyles(source));
  expect(fixed).toContain('height: 420px;');
  expect(fixed).toContain('padding: 30px;');
  expect(fixed).not.toContain('*,*::before,*::after{box-sizing:border-box}');
  expect(openingComponentPresentation(source, '', false)).toBe('\n' + source);
  const unrelated = source.replaceAll('multi-char-panel-coffee', 'unrelated-panel');
  expect(openingComponentPresentation(unrelated, '', true)).not.toContain('*,*::before,*::after{box-sizing:border-box}');
});

test('independent box sizing preserves author resets and responsive containment without class-name recipes', () => {
  const authorReset = '<style>*{box-sizing:border-box}.audio-player{width:85%;padding:14px}</style>';
  const adapter = '<style data-mufy-adaptation="mobile-box-model">@media(max-width:480px){html,body{max-width:100%}*,*::before,*::after{box-sizing:border-box}img{max-width:100%}}</style>';
  const original = authorReset + '<div class="audio-player">Music</div>' + adapter;
  const fixed = openingComponentPresentation(original, '', true);
  expect(fixed).toContain(authorReset);
  expect(fixed).toContain('img{max-width:100%}');
  expect(fixed).toContain('html,body{max-width:100%}');
  expect(fixed).toContain('html,body{box-sizing:border-box}');
  expect(fixed).not.toContain('*,*::before,*::after{box-sizing:border-box}');
  expect(openingComponentPresentation(original, '', false)).toBe('\n' + original);
});
