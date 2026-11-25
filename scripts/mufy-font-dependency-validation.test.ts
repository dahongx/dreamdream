import { expect, test } from 'bun:test';
import { validateFontDependencies } from './mufy-font-dependency-validation';
const source = '@font-face{font-family:"Original Title";src:url(https://example.org/title.woff2)}.title{font-family:"Original Title",serif}';
test('a retained family reference without its definition fails', () => {
  expect(validateFontDependencies(source, '.title{font-family:"Original Title",serif}', ['"Original Title", serif']).missingFamilies).toEqual(['original title']);
});
test('matching declaration still cannot certify downloaded font or visual fidelity', () => {
  const result = validateFontDependencies(source, source, ['"Original Title",serif']);
  expect(result.declarationParity).toBe(true);
  expect(result.resourceLoadVerified).toBe(false);
  expect(result.visualAccepted).toBe(false);
});
test('do not invent font dependencies for unused faces or system fonts', () => {
  expect(validateFontDependencies(source, '', ['Arial,sans-serif']).missingFamilies).toEqual([]);
});
test('changed font resource cannot pass as the original', () => {
  expect(validateFontDependencies(source, source.replace('title.woff2', 'other.woff2'), ['Original Title']).changedSources).toEqual(['original title']);
});
test('comments and empty declarations do not supply a font', () => {
  expect(validateFontDependencies(source, '/* '+source+' */', ['Original Title']).missingFamilies).toHaveLength(1);
  expect(validateFontDependencies(source, '@font-face{font-family:"Original Title"}', ['Original Title']).changedSources).toHaveLength(1);
});
test('CSS parse failure stops acceptance rather than returning a clean result', () => {
  expect(() => validateFontDependencies(source, 'x{', ['Original Title'])).toThrow();
});
