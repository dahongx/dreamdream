import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

const started = performance.now();
const base = 'logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const dir = `${base}/final-acceptance/21`;
const source = JSON.parse(await readFile(`${dir}/source-public-component-inventory.json`, 'utf8'));
const capture = JSON.parse(await readFile(`${dir}/greeting-header-public-srcdoc-20261104.json`, 'utf8'));
const original = String(source.roots[1].frames[0].html);
const sourceDOM = new JSDOM(original);
const header = sourceDOM.window.document.querySelector('.censy-pure-box-v5');
if (!header) throw new Error('SOURCE_HEADER_MISSING');
const normalized = (text: string) => text.replace(/\s+/g, ' ').trim();
const sourceHeader = normalized(header.textContent ?? '');
const sourceStyles = [...sourceDOM.window.document.querySelectorAll('style')].map(s => s.textContent ?? '');
const results = capture.frames.map((frame: {index: number; srcdoc: string}) => {
  const parsed = new JSDOM(frame.srcdoc);
  try {
    const box = parsed.window.document.querySelector('.censy-pure-box-v5');
    const styles = [...parsed.window.document.querySelectorAll('style')].map(s => s.textContent ?? '').join('\n');
    return {
      targetFrameIndex: frame.index,
      headerPresent: Boolean(box),
      headerText: normalized(box?.textContent ?? ''),
      sourceHeaderTextExact: normalized(box?.textContent ?? '') === sourceHeader,
      authoredStyleBlocksPreserved: sourceStyles.map(css => styles.includes(css)),
      publicDocumentSha256: createHash('sha256').update(frame.srcdoc).digest('hex'),
    };
  } finally { parsed.window.close(); }
});
sourceDOM.window.close();
if (results.length !== 3 || results.some((r: {headerPresent: boolean}) => !r.headerPresent)) throw new Error('HEADER_COVERAGE_MISSING');
const observedAt = new Date().toISOString();
const evidence = {
  observedAt, elapsedMs: performance.now() - started, kind: 'local-public-DOM-comparison',
  rank: 21, sourceRootIndex: 1, sourceIndex: 0,
  sourceSnapshotObservedAt: source.observedAt, targetCaptureObservedAt: capture.observedAt,
  sourceHeader, results,
  finding: 'Greeting header and two existing reply headers are present; reply values are intentionally dynamic. Current source UI is inaccessible, so this does not prove current source visual fidelity.',
  targetPresenceVerified: true, visualFidelityVerified: false, fullCardAccepted: false,
};
await writeFile(`${dir}/greeting-header-binding-20261104.json`, JSON.stringify(evidence, null, 2));
const path = `${dir}/component-ui-mapping.json`;
const mapping = JSON.parse(await readFile(path, 'utf8'));
const row = mapping.rows.find((r: {sourceRootIndex?: number; sourceIndex: number}) => r.sourceRootIndex === 1 && r.sourceIndex === 0);
if (!row) throw new Error('ADDITIONAL_ROOT_MAPPING_MISSING');
Object.assign(row, {
  targetUiVerified: true,
  evidence: 'final-acceptance/21/greeting-header-binding-20261104.json',
  reason: evidence.finding,
  fidelityVerified: false,
});
await writeFile(path, JSON.stringify(mapping, null, 2));
await appendFile(`${base}/timing-runs.jsonl`, JSON.stringify({stepId: 'rank21-greeting-header-binding-20261104', observedAt, elapsedMs: performance.now() - started, kind: 'local-processing', browserElapsedMs: 0, agentNetMs: null}) + '\n');
console.log(JSON.stringify({rank:21,headers:results.length,greetingTextExact:results[0].sourceHeaderTextExact,visualFidelityVerified:false}));

