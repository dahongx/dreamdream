import { expect, test } from 'bun:test';
import { sourceRuleTransfer, mufySourceSpeechSkin, MUFY_SOURCE_CANVAS_BASELINE } from '../mufy-source-rule-transfer';
import { parseExternalRulesJson } from '../external-card';
import { MUFY_SOURCE_ENVELOPE_PREFIX } from '../mufy-source-rules';

const capture = {
  version: 1, roleId: 'test-role', capturedAt: new Date().toISOString(),
  captureScope: 'normal-page-public-render-rules', responseCode: 200,
  responseDataWasNull: false,
  rules: [{ regexRuleId: 1, ruleName: 'panel', regPattern: '/<panel>([\\s\\S]*?)<\\/panel>/g', replaceString: '<div>$1</div>' }],
};
test('source envelope survives the normal UI rule import format', () => {
  const transfer = sourceRuleTransfer(capture, 'test-role');
  const parsed = parseExternalRulesJson(JSON.stringify(transfer.rules));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw Error(parsed.error);
  expect(parsed.value[0].replacement.startsWith(MUFY_SOURCE_ENVELOPE_PREFIX)).toBe(true);
  expect(transfer.ruleCount).toBe(1);
});
test('missing or wrong-role responses cannot become an empty renderer', () => {
  expect(() => sourceRuleTransfer(undefined, 'test-role')).toThrow();
  expect(() => sourceRuleTransfer(capture, 'other-role')).toThrow();
  expect(sourceRuleTransfer({ ...capture, responseDataWasNull: true, rules: [] }, 'test-role').rules).toEqual([]);
  expect(()=>sourceRuleTransfer({...capture,unexpectedPrivateField:'must-not-stage'},'test-role')).toThrow('UNEXPECTED_RENDER_CAPTURE_FIELD');
});
test('public speech avatars remain opted in without modifying the source regex input',()=>{
  const transfer=sourceRuleTransfer(capture,'test-role','body{color:teal}','https://cdn.example.test/avatar.png');
  const data=JSON.parse(transfer.rules[0].replaceString!.slice(MUFY_SOURCE_ENVELOPE_PREFIX.length));
  expect(data.skinCss).toContain('.mufy-source-canvas :is(message,mes)::before');
  expect(data.skinCss).toContain('https://cdn.example.test/avatar.png');
  expect(data.skinCss).toContain(':where(.mufy-source-canvas summary){box-sizing:border-box}');
  expect(data.skinCss).toContain(':where(.mufy-source-canvas img,.mufy-source-canvas video){max-width:100%;height:auto}');
  expect(data.skinCss.startsWith(MUFY_SOURCE_CANVAS_BASELINE+'body{color:teal}')).toBe(true);
  expect(data.rules[0].source).toContain('<panel>');
  expect(mufySourceSpeechSkin()).toBe('');
  expect(()=>mufySourceSpeechSkin('javascript:alert(1)')).toThrow();
});
