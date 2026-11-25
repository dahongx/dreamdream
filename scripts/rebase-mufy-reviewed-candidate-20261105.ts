import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

// Local composition only. The live baseline was captured by authorized read-only
// SSH; never upload the old snapshot over independently fixed live components.
const started = performance.now();
const old = 'outputs/mufy-batch30-composed-review-20261105b';
const live = 'outputs/mufy-current-baseline-2026-11-05T12-19-40-720Z';
const out = 'outputs/mufy-batch30-composed-review-20261105c';
const hash = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const manifest = JSON.parse(await readFile(old + '/manifest.json', 'utf8'));
const baseline = JSON.parse(await readFile(live + '/manifest.json', 'utf8'));
await mkdir(out, { recursive: true });
await cp(old + '/snapshot', out + '/snapshot', { recursive: true });
const replaceOnce = (s: string, from: string, to: string) => {
  if (s.split(from).length !== 2) throw Error('NON_UNIQUE_REBASE_BOUNDARY:' + from.slice(0, 70));
  return s.replace(from, () => to);
};
const readLive = async (path: string) => (await readFile(live + '/baseline/' + path, 'utf8')).replace(/\r\n/g, '\n');
const changes = new Map<string, string>();
const rendererPath = 'src/components/chat/MessageRenderer.tsx';
let renderer = await readLive(rendererPath);
renderer = replaceOnce(renderer, '  artifactMinHeight?: number;', '  artifactMinHeight?: number;\n  mufySourceDefaults?: boolean;');
renderer = replaceOnce(renderer, 'inline, artifactMinHeight }: CodeProps)', 'inline, artifactMinHeight, mufySourceDefaults }: CodeProps)');
renderer = replaceOnce(renderer, '<ArtifactIframe srcdoc={source} minHeight={artifactMinHeight} />', '<ArtifactIframe srcdoc={source} minHeight={artifactMinHeight} mufySourceDefaults={mufySourceDefaults} />');
renderer = replaceOnce(renderer, '<CodeOrArtifact {...props} artifactMinHeight={1} />', '<CodeOrArtifact {...props} artifactMinHeight={1} mufySourceDefaults />');
renderer = replaceOnce(renderer, '<ArtifactIframe {...props} minHeight={1} />', '<ArtifactIframe {...props} minHeight={1} mufySourceDefaults />');
if (!renderer.includes('{typographyStyle&&<style>{typographyStyle}</style>}')) throw Error('LIVE_REPLY_TYPOGRAPHY_LOST');
changes.set(rendererPath, renderer);
const floatingPath = 'src/components/chat/FloatingSlot.tsx';
let floating = await readLive(floatingPath);
floating = replaceOnce(floating, "import {MufyGhostInstructions} from './MufyGhostInstructions';", "import {MufyGhostInstructions} from './MufyGhostInstructions';\nimport {MufyFoxToolkit} from './MufyFoxToolkit';");
const imageCase = "        w.nativeImageSidebar?.variant==='image-island' ?";
floating = replaceOnce(floating, imageCase, "        w.nativeImageSidebar?.variant==='fox-toolkit' && w.nativeImageSidebar.foxToolkit ? <MufyFoxToolkit key={w.key} data={w.nativeImageSidebar.foxToolkit} characterId={character.id} onReplaceComposer={onReplaceComposer} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :\n" + imageCase);
if (!floating.includes('SOURCE_VIEWPORT_DETAILS_COORDINATES') || !floating.includes('postDrawerState(containerRef.current, true)')) throw Error('LIVE_DRAWER_FIX_LOST');
changes.set(floatingPath, floating);
changes.set('src/components/chat/mufy-shared-component-context.ts', await readLive('src/components/chat/mufy-shared-component-context.ts'));
const pkg = JSON.parse(await readLive('package.json'));
pkg.dependencies['css-tree'] = '3.2.1';
changes.set('package.json', JSON.stringify(pkg, null, 2) + '\n');
for (const [path, text] of changes) {
  await mkdir(dirname(out + '/snapshot/' + path), { recursive: true });
  await writeFile(out + '/snapshot/' + path, text);
}
const files = [];
for (const entry of manifest.files) {
  const bytes = await readFile(out + '/snapshot/' + entry.path);
  files.push({ ...entry, sha256: hash(bytes), from: out + '/snapshot/' + entry.path,
    provenance: changes.has(entry.path) ? 'current TEST baseline + narrowly reapplied migration delta' : entry.provenance,
    currentBaselineSha256: baseline.files.find((r: { path: string }) => r.path === entry.path)?.currentSha256 ?? null });
}
const report = { observedAt: new Date().toISOString(), parentCandidate: old + '/manifest.json',
  liveBaseline: live + '/manifest.json', basedOnImage: baseline.basedOnImage, status: 'rebased-pending-integration-tests', files,
  preserved: ['live reply typography context and injection', 'live viewport drawer geometry and state relay', 'live package scripts'],
  excluded: ['unreviewed Bilibili sandbox expansion', 'separate profile-box delta requiring follow-up review'],
  applicationBuild: false, deployed: false, elapsedMs: performance.now() - started };
await writeFile(out + '/manifest.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out, files: files.length, rebased: [...changes.keys()], elapsedMs: report.elapsedMs }));
