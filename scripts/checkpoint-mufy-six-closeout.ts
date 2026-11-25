import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Offline checkpoint only. Never upgrades structural evidence to fidelity pass.
const startedAt = new Date().toISOString();
const started = performance.now();
const base = 'logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const root = `${base}/strict-acceptance-20261024`;
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const audit = await readJson(`${root}/automatic-state-validation.json`);
if (audit.observed !== 192 || audit.errors.length || audit.coverage.length !== 6 ||
    audit.coverage.some((c: { openings: number; replies: number }) => c.openings !== 16 || c.replies !== 16)) {
  throw new Error('EXPECTED_COMPLETE_ZERO_ERROR_STRUCTURAL_AUDIT');
}
const keys = ['duanjiachen', 'junlishang', 'qie', 'fuchiling', 'xieyan', 'chengfeng'];
const notes = [
  'Four rounded silver status headings visible; expanded content and collapsed/reopened presentations distinguishable.',
  'Three dark red status headings and expanded content visible; source-style notice remains over the transcript.',
  'Speech avatars and red headings visible; decorative glyph appearance still requires a matching source reply comparison.',
  'Four status headings and memory section visible; expanded content and collapsed presentation distinguishable.',
  'Four named status groups and right-side MENU visible; character-state grid readable in the mobile capture.',
  'Decorative status headings and Memory archive visible; expanded system grid visible; this does not certify empty avatar templates.',
];
const reviews = [];
for (let i = 0; i < keys.length; i++) {
  const path = `contact-sheets/${keys[i]}-reply-2.png`;
  const bytes = await readFile(`${root}/${path}`);
  reviews.push({ key: keys[i], path, sha256: createHash('sha256').update(bytes).digest('hex'),
    review: 'contact-sheet-displayed-and-inspected', note: notes[i],
    scope: 'Eight viewport thumbnails; not full component content or source pixel equivalence', finalFidelityAccepted: false });
}
let measuredCurrentEvidenceMs = 0;
const unique = new Set<string>();
for (const row of audit.results) {
  const path = `${row.group}/${row.file}`;
  if (unique.has(path)) throw new Error(`DUPLICATE:${path}`);
  unique.add(path);
  const proof = await readJson(`${root}/${path}`);
  if (!Number.isFinite(proof.elapsedMs) || proof.elapsedMs < 0) throw new Error(`INVALID_DURATION:${path}`);
  measuredCurrentEvidenceMs += proof.elapsedMs;
}
const fontDependencyAudit = await readJson(`${root}/font-dependency-validation.json`);
if (fontDependencyAudit.visualAccepted !== false || !Array.isArray(fontDependencyAudit.missingFamilies)) {
  throw new Error('INVALID_FONT_DEPENDENCY_AUDIT');
}
const checkpoint = {
  recordedAt: startedAt, status: 'structural-regression-complete-source-fidelity-pending',
  scope: 'Six imported cards only; first ten and four excluded cards untouched',
  expectedStates: 192, savedStates: 192, missingStates: 0, automaticErrors: 0,
  acceptedCards: 0, fullFidelityAccepted: false,
  fontDependencyAudit,
  fontRegression: { passed: 6, failed: 0, file: 'scripts/mufy-font-dependency-validation.test.ts',
    note: 'Offline declaration checks only; no claim of loaded resource or identical pixels.' },
  automaticAudit: 'automatic-state-validation.json', coverage: audit.coverage,
  localRegression: { passed: 19, failed: 0, reportedRunnerMs: 17100,
    files: ['src/lib/__tests__/mufy-browser-state-driver.test.ts', 'scripts/mufy-fold-state-validation.test.ts'] },
  repairs: [
    { card: '亓厄', theme: '../qie-theme-after-canvas-width-repair.css', verifiedOpeningStates: 16,
      note: 'Under 340px iframe canvas, headings use 14px and smaller padding; password panel uses border-box. This is responsive adaptation, not pixel-identical typography.' },
    { card: '程烽', theme: '../chengfeng-theme-after-narrow-stage-repair.css', verifiedOpeningStates: 16,
      note: 'Negative trailing title margin removed only below 400px; source text/font/tracking retained.' },
  ],
  secondReplyVisualReviews: reviews,
  remaining: [
    'Strict source/target/renderer-bound fidelity reports have not been completed; 192 structural states alone cannot satisfy this gate.',
    'Qie decorative reply glyphs lack an equivalent source-reply visual observation; the live source page currently shows its opening.',
    'Chengfeng empty img.ak-av template slots are not certified populated status avatars; compare source behavior before treating them as a migration fault.',
  ],
  timing: { measuredCurrentEvidenceMs, scope: 'Sum of 192 retained browser steps, including loading/capture; excludes discarded attempts and unmeasured analysis.',
    wholeAgentNetWorkMs: null, netWorkNote: 'Not a net labor total. No scheduling gaps or user waiting added; historical exact net labor remains unavailable.' },
  databaseOperations: false, productionChanges: false, newPaidReplies: 0,
};
// New targeted browser observations supersede the two previously unknown items.
// Keep the structural result separate from a confirmed visual compatibility gap.
try {
  const avatars = await readJson(`${root}/chengfeng-source-avatar-check.json`);
  const font = await readJson(`${root}/qie-font-compatibility.json`);
  if (avatars.avatars.length !== 6 || avatars.avatars.some((a: { src: string | null }) => a.src !== null)) {
    throw new Error('SOURCE_AVATAR_CONTRACT_CHANGED');
  }
  if (!font.sourceFontFacePresent || font.targetFontFacePresent || font.titles.length !== 8) {
    throw new Error('FONT_FINDING_NOT_CONFIRMED');
  }
  checkpoint.status = 'structural-regression-complete-one-confirmed-font-gap';
  checkpoint.remaining = [
    'Qie: source CensyCustomTitleFont @font-face exists, but the rendered TEST host CSS lacks it. Eight live headings reference that undefined custom family. Host CSS intentionally rejects @font-face; do not weaken this protection. A supported isolated component is the repair direction, not substituting glyphs.',
    'Authorized browser acquisition of the original public font failed. This is not proof of a permanent source outage. Original font rendering has not been verified; do not certify identical glyphs.',
    'Strict source/target/renderer-bound fidelity reports remain incomplete; structural success is not full fidelity acceptance.',
  ];
  checkpoint.secondReplyVisualReviews[5].note += ' Follow-up live Mufy opening observation confirms six img.ak-av slots have no src on the source as well; retained empty template slots are source-consistent, not lost images.';
  checkpoint.secondReplyVisualReviews[2].note += ' Follow-up found a genuine missing custom-font declaration in the TEST host CSS; see qie-font-compatibility.json.';
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
try {
  const suppliedFont = await readJson(`${root}/supplied-font-validation.json`);
  if (suppliedFont.originalFontAcquired !== true || suppliedFont.sha256 !== '51271b875de0235ba75bdf5f7e13f9ff885990147c7c742c115c58368693d34b') throw Error('INVALID_SUPPLIED_FONT_PROOF');
  checkpoint.remaining = checkpoint.remaining.filter(note => !note.startsWith('Authorized browser acquisition'));
  checkpoint.remaining.push('Original font supplied by user and verified: supplied-font-validation.json. It lacks U+1065A/U+22B9/U+A673, so missing host font-face alone is not a proven cause of decorative tofu. Restore the original font safely and verify source fallback glyphs separately. Not deployed or visually accepted yet.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
await writeFile(`${root}/continuation-20261025-checkpoint.json`, JSON.stringify(checkpoint, null, 2));
const old = await readFile(`${root}/self-check-handoff.json`, 'utf8');
try { await writeFile(`${root}/self-check-handoff-before-20261025.json`, old, { flag: 'wx' }); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
await writeFile(`${root}/self-check-handoff.json`, JSON.stringify(checkpoint, null, 2));
await writeFile(`${root}/closeout-checkpoint-compute.json`, JSON.stringify({startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - started, kind: 'offline-checkpoint-only', network: false}, null, 2));
console.log(JSON.stringify({states: unique.size, automaticErrors: 0, measuredCurrentEvidenceMs, fullFidelityAccepted: false}));
