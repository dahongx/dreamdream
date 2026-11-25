import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { buildIframeSrcdoc, sourceComponentFallbacks, wrapBareSrcdoc } from '../regex/iframe-bridge';

const comments = `<style>.interaction-area{background:#f7f7f7}.user-link{color:blue}</style><div class="interaction-area"><div class="comment-item"><b class="user-link">User</b>Comment</div></div>`;
const player = `<div id="cy-audio-deck"><div id="cy-btn-play">Play</div><audio id="cy-audio-core"></audio></div>`;

test('ordinary and dark components retain the original platform defaults', () => {
  expect(sourceComponentFallbacks('<div class="comment-item">dark</div>')).toBe('\n');
  expect(sourceComponentFallbacks(comments.replace('#f7f7f7', '#181818'))).not.toContain('light-comments');
  expect(sourceComponentFallbacks('<audio src="song.mp3"></audio>')).not.toContain('empty-cy-player');
});

test('light source comments receive only a zero-specificity inherited fallback', () => {
  const extra = sourceComponentFallbacks(comments);
  expect(extra).toContain(':where(.interaction-area){color-scheme:light;color:CanvasText}');
  expect(extra).not.toContain('!important');
  expect(extra).not.toContain('html{');
  for (const result of [wrapBareSrcdoc(comments), buildIframeSrcdoc({ srcdoc: comments, captureGroups: [] })]) {
    expect(result).toContain(comments);
    expect(result.indexOf('light-comments')).toBeLessThan(result.indexOf(comments));
    expect(result).toContain("connect-src 'none'");
  }
});

function mount(src: string) {
  const dom = new JSDOM(src);
  const script = sourceComponentFallbacks(src).match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw Error('Missing compatibility script');
  // Only our synthetic fixture and our own compatibility code execute here.
  new Function('document', 'MutationObserver', script)(dom.window.document, dom.window.MutationObserver);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom.window;
}

test('missing custom audio cannot claim Pause or trigger its source click handler', () => {
  const w = mount(player), btn = w.document.getElementById('cy-btn-play')!;
  let clicks = 0;
  btn.addEventListener('click', () => { clicks++; btn.textContent = 'Pause'; });
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(clicks).toBe(0);
  expect(btn.textContent).toBe('Audio unavailable');
  expect(btn.getAttribute('aria-disabled')).toBe('true');
});

test('available audio keeps source behavior and restored audio releases the empty guard', async () => {
  const w = mount(player.replace('<audio ', '<audio src="song.mp3" '));
  const btn = w.document.getElementById('cy-btn-play')!;
  btn.addEventListener('click', () => { btn.textContent = 'Pause'; });
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  expect(btn.textContent).toBe('Pause');
  expect(btn.hasAttribute('aria-disabled')).toBe(false);
  const empty = mount(player), restored = empty.document.getElementById('cy-btn-play')!;
  empty.document.getElementById('cy-audio-core')!.setAttribute('src', 'restored.mp3');
  await Promise.resolve();
  expect(restored.textContent).toBe('Play');
  expect(restored.hasAttribute('aria-disabled')).toBe(false);
});

test('real audio errors use the unavailable state without altering other players', () => {
  const w = mount(player.replace('<audio ', '<audio src="failed.mp3" '));
  const audio = w.document.getElementById('cy-audio-core')!;
  Object.defineProperty(audio, 'error', { value: { code: 4 } });
  audio.dispatchEvent(new w.Event('error'));
  expect(w.document.getElementById('cy-btn-play')!.textContent).toBe('Audio unavailable');
});
