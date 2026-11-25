/** Repair the observed missing fence before this legacy sidebar only.
 * Literal fence examples inside the sidebar's help JavaScript are untouched. */
export function repairMufySidebarBoundary(content: string): string {
  const boundary = '\n```html\n<template id="luludawang-censybaby">';
  const index = content.indexOf(boundary);
  if (index < 0) return content;
  const prefix = content.slice(0, index);
  const fences = prefix.match(/```(?:html)?[ \t]*(?=\r?\n|$)/g) ?? [];
  if (fences.length % 2 !== 1) return content;
  return `${prefix}\n\x60\x60\x60${content.slice(index)}`;
}
