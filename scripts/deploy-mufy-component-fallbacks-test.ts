/** Authorized 8091-only component fix; no database or stored-card writes. */
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
if (!process.argv.includes('--commit-test')) throw Error('--commit-test required');
const file = 'src/lib/regex/iframe-bridge.ts';
const baseline = '9fb44f30e130973d3e601f3c13168cf9aeda25a46d357a5a300dae17993edae9';
const root = resolve('logs/mufy-profiles/full-20261013/pilot-5');
const startedAt = new Date().toISOString(), start = performance.now(), stamp = startedAt.replace(/\D/g, '');
const backup = `/root/mufy-transfer-archive-20261015/component-fallbacks-${stamp}`;
const ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'root@115.29.213.73'];
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
async function run(args: string[], capture = false) {
  const child = Bun.spawn(args, { stdout: capture ? 'pipe' : 'inherit', stderr: 'inherit' });
  const output = capture ? await new Response(child.stdout).text() : '';
  if (await child.exited) throw Error(`TEST command failed: ${args[0]}`);
  return output;
}
let ok = false;
const candidate = (await readFile(file, 'utf8')).replaceAll('\r\n', '\n');
const begin = candidate.indexOf('/** Source-component fallbacks,');
const end = candidate.indexOf('/**\n * 给一段裸 srcdoc', begin);
if (begin < 0 || end < 0) throw Error('Exact patch boundaries required');
const stripped = (candidate.slice(0, begin) + candidate.slice(end))
  .replace('    sourceComponentFallbacks(srcdoc),\n', '')
  .replace('    sourceComponentFallbacks(payload.srcdoc),\n', '');
if (hash(stripped) !== baseline) throw Error('Unrelated local changes refused');
try {
 await requireTestDiskCapacity(run,ssh);
  const port = await run([...ssh, 'cd /root/projects/yearn-chat && docker compose port app 3000'], true);
  if (!/^0\.0\.0\.0:8091\s*$/m.test(port)) throw Error('Exact TEST port required');
  const remote = await run([...ssh, `cd /root/projects/yearn-chat && sha256sum ${file}`], true);
  if (remote.split(/\s/)[0] !== baseline) throw Error('Remote baseline changed; refusing overwrite');
  const archive = resolve(root, `component-fallbacks-${stamp}.tar`);
  await run(['tar', '-cf', archive, file]);
  await run([...ssh, `umask 077; mkdir -p ${backup}`]);
  await run(['scp', '-q', archive, `root@115.29.213.73:${backup}/patch.tar`]);
  await run([...ssh, `set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${file}; docker tag yearn-chat-app yearn-chat-app:component-fallbacks-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 45 ${backup}/build.log; exit 1; fi; docker compose ps app --format '{{.State}} {{.Ports}}'`]);
  ok = true;
} finally {
  const report = { scope: 'TEST', port: 8091, startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - start, ok, files: [file], baseline, candidateSha256: hash(candidate), backup, databaseCommands: 0, productionWrites: 0, visualAccepted: false };
  await writeFile(resolve(root, `component-fallbacks-${stamp}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
