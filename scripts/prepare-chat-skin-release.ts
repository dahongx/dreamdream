/** Read-only TEST baseline capture and narrow release candidate. No deployment. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
const target = 'root@115.29.213.73';
const output = 'outputs/chat-skin-upgrade/release-candidate';
const startedAt = new Date().toISOString();
const start = performance.now();
function run(args: string[]) {
  const p = Bun.spawnSync(args, { stderr: 'inherit' });
  if (p.exitCode) throw Error('COMMAND_FAILED');
  return p.stdout.toString();
}
const remote = (cmd: string) => run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', target, cmd]);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim();
if (remote('cd /root/projects/yearn-chat && docker compose port app 3000').trim() !== '0.0.0.0:8091') throw Error('WRONG_TARGET');
const files = ['src/components/chat/ChatStage.tsx', 'src/components/chat/OpeningSlot.tsx', 'src/lib/styling/whitelist.ts', 'src/components/chat/ChatRoom.tsx', 'src/lib/import/mufy-migration.ts'];
const added = ['src/components/chat/source-stage.module.css', 'src/lib/styling/style-block-boundary.ts', 'src/lib/import/mufy-component-presentation.ts'];
const entries: {path: string; before: string | null; after: string}[] = [];
function replaceOnce(source: string, needle: string, replacement: string) {
  if (source.split(needle).length !== 2) throw Error('AMBIGUOUS_PATCH_ANCHOR');
  return source.replace(needle, replacement);
}
for (const path of files) {
  const before = remote(`cd /root/projects/yearn-chat && cat ${path}`);
  let after: string;
  if (path.endsWith('/ChatRoom.tsx')) {
    after = replaceOnce(before, '      <ChatStage\n', '      <ChatStage\n        sourcePresentation={hasMufyAdaptedComponent(openingComponents) || hasMufyRenderedOpening(rules)}\n');
    after = replaceOnce(after, 'import { isExplicitModelRefusal }', 'import { hasMufyAdaptedComponent, hasMufyRenderedOpening } from "@/lib/import/mufy-native-table";\nimport { isExplicitModelRefusal }');
  } else if (path.endsWith('/mufy-migration.ts')) {
    after = replaceOnce(before, 'import postcss from "postcss";', 'import postcss from "postcss";\nimport { closeStyleBlockAtEof } from "@/lib/styling/style-block-boundary";');
    after = replaceOnce(after, 'extractStyleBlocks(optimizationCode).join("\\n\\n")', 'extractStyleBlocks(optimizationCode).map(closeStyleBlockAtEof).join("\\n\\n")');
  } else {
    const base = run(['git', 'show', `HEAD:${path}`]);
    if (normalize(base) !== normalize(before)) throw Error('REMOTE_BASELINE_CHANGED: ' + path);
    after = await readFile(path, 'utf8');
  }
  await mkdir(dirname(`${output}/before/${path}`), { recursive: true });
  await mkdir(dirname(`${output}/patch/${path}`), { recursive: true });
  await writeFile(`${output}/before/${path}`, before);
  await writeFile(`${output}/patch/${path}`, after);
  entries.push({path, before: hash(before), after: hash(after)});
}
for (const path of added) {
  // Refuse to overwrite a file that appeared on TEST since the prototype.
  if (remote(`test -e /root/projects/yearn-chat/${path} && echo exists || echo absent`).trim() !== 'absent') throw Error('NEW_FILE_ALREADY_EXISTS: ' + path);
  const after = await readFile(path, 'utf8');
  await mkdir(dirname(`${output}/patch/${path}`), { recursive: true });
  await writeFile(`${output}/patch/${path}`, after);
  entries.push({path, before: null, after: hash(after)});
}
const report = { startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - start, target: '115.29.213.73:8091', entries, deployed: false, databaseTouched: false };
await writeFile(`${output}/manifest.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
