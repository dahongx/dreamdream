import { expect, test } from 'bun:test';
import { restoreMufyPublicContentCss } from '../mufy-public-content-css';
import { sanitizeAndScopeCss } from '../../styling/whitelist';

test('preserves author content classes and scroll containment through host conversion', () => {
  const css = restoreMufyPublicContentCss([
    '.mufy_author_scroll { overflow-y: auto; max-height: 110px } #mufy_chat_header { color: red }',
  ], ['mufy_author_scroll']);
  const result = sanitizeAndScopeCss(css, 'test');
  expect(result.css).toContain('.mufy\\_author_scroll');
  expect(result.css).toContain('overflow-y: auto');
  expect(result.css).toContain('#nj_chat_messages');
  expect(result.css).not.toContain('chat_header');
  expect(result.warnings).toEqual([]);
});

test('does not restore unrelated page styles or malformed blocks', () => {
  expect(restoreMufyPublicContentCss(['body { color:red }', '.mufy_owned {'], ['mufy_owned'])).toBe('');
  expect(restoreMufyPublicContentCss(['.mufy_other { color:red }'], ['mufy_owned'])).toBe('');
});
