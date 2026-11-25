import { expect, test } from 'bun:test';
import { restoreMufyPublicFrameTokens } from '../mufy-public-frame-tokens';

test('restores script replacement tokens as literal bytes without copying siblings', () => {
  const script = "<script>const a = \"$'\"; const b = '$&'; const c = '$`';</script>";
  expect(restoreMufyPublicFrameTokens('A MUFY_PUBLIC_FRAME_0 B MUFY_PUBLIC_FRAME_1 C', [script, '<p>second</p>']))
    .toBe(`A ${script} B <p>second</p> C`);
});

test('restoration is one pass and does not replace marker-like author text inside frames', () => {
  expect(restoreMufyPublicFrameTokens('MUFY_PUBLIC_FRAME_0 MUFY_PUBLIC_FRAME_1', ['MUFY_PUBLIC_FRAME_1', 'last']))
    .toBe('MUFY_PUBLIC_FRAME_1 last');
});

test('unknown source marker fails rather than shipping an incomplete component', () => {
  expect(() => restoreMufyPublicFrameTokens('MUFY_PUBLIC_FRAME_8', [])).toThrow('UNRESOLVED_PUBLIC_FRAME');
});
