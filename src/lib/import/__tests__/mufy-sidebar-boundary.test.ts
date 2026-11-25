import { expect, test } from 'bun:test';
import { repairMufySidebarBoundary } from '../mufy-sidebar-boundary';
test('repairs a missing boundary without changing sidebar help examples', () => {
  const input = '```html\n<body>Theater</body>\n```html\n<template id="luludawang-censybaby">Menu</template>\n<script>const help="```html和```";</script>\n```';
  const fixed = repairMufySidebarBoundary(input);
  expect(fixed).toContain('</body>\n```\n```html');
  expect(fixed).toContain('const help="```html和```";');
  expect(repairMufySidebarBoundary(fixed)).toBe(fixed);
});
test('preserves standalone sidebar and unrelated documents', () => {
  const sidebar = '```html\n<template id="luludawang-censybaby">Menu</template>\n```';
  expect(repairMufySidebarBoundary(sidebar)).toBe(sidebar);
  expect(repairMufySidebarBoundary('```html\n<div>Other</div>\n```')).toBe('```html\n<div>Other</div>\n```');
});
