/** Local extraction only. No browser, network, credentials, database or import. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';

const started = performance.now();
const base = resolve('logs/mufy-profiles/full-20261013');
const output = resolve('outputs/mufy-local-archives-rank52-100-20261109');
const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
type Source = { key: string; promptSha256: string };
type Card = { rank: number; name: string; sourceKey: string; sourceUrl: string };
const { archive } = JSON.parse(await readFile(join(base, 'job.json'), 'utf8')) as { archive: string };
const sources = new Map((JSON.parse(await readFile(join(base, 'sources.json'), 'utf8')) as Source[]).map(s => [s.key, s]));
const roster = JSON.parse(await readFile(join(base, 'migration-status-100.json'), 'utf8')) as { rows: Card[] };
const cards = roster.rows.filter(c => c.rank >= 52 && c.rank <= 100);
if (cards.length !== 49 || new Set(cards.map(c => c.sourceKey)).size !== 49) throw new Error('ROSTER_COUNT_OR_DUPLICATE');
const wanted = new Map(cards.map(c => [c.sourceKey, c]));
await mkdir(output); // Fail on an existing destination; never overwrite another worker's inputs.
const child = spawn('D:/program/anaconda3/Library/bin/zstd.exe', ['-dc', archive], { stdio: ['ignore', 'pipe', 'pipe'] });
child.stderr.resume();
const exited = new Promise<void>((ok, fail) => {
  child.once('error', fail);
  child.once('close', code => code === 0 ? ok() : fail(new Error(`ARCHIVE_EXIT:${code}`)));
});
const rows: (Card & { promptPath: string; jsonPath: string; promptSha256: string; recordSha256: string })[] = [];
try {
  for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
    const item = JSON.parse(line) as { character_key: string; text: string };
    const card = wanted.get(item.character_key);
    if (!card) continue;
    if (rows.some(r => r.sourceKey === card.sourceKey)) throw new Error(`DUPLICATE_ARCHIVE_KEY:${card.sourceKey}`);
    if (typeof item.text !== 'string' || !item.text.length) throw new Error(`EMPTY_ORIGINAL:${card.sourceKey}`);
    const sha = digest(item.text);
    if (sha !== sources.get(card.sourceKey)?.promptSha256) throw new Error(`ORIGINAL_HASH_MISMATCH:${card.sourceKey}`);
    const dir = join(output, card.sourceKey);
    await mkdir(dir);
    const promptPath = join(dir, 'prompt.txt');
    const jsonPath = join(dir, 'archive-record.json');
    await writeFile(promptPath, item.text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await writeFile(jsonPath, line + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    if (digest(await readFile(promptPath, 'utf8')) !== sha) throw new Error(`READBACK_MISMATCH:${card.sourceKey}`);
    const back = JSON.parse(await readFile(jsonPath, 'utf8')) as { character_key: string; text: string };
    if (back.character_key !== card.sourceKey || digest(back.text) !== sha) throw new Error(`RECORD_READBACK_MISMATCH:${card.sourceKey}`);
    rows.push({ ...card, promptPath, jsonPath, promptSha256: sha, recordSha256: digest(line + '\n') });
  }
  await exited;
  if (rows.length !== 49) throw new Error(`MISSING_ARCHIVES:${49 - rows.length}`);
  rows.sort((a, b) => a.rank - b.rank);
  const manifest = { observedAt: new Date().toISOString(), scope: 'Exact original archive extraction, not a migration or acceptance', archive, count: rows.length, allOriginalHashesVerified: true, networkAccess: false, databaseAccess: false, sourceArchiveUnchanged: true, elapsedMs: performance.now() - started, rows };
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  await writeFile(join(output, 'README.md'), '# 第52–100号本地原始档案\n\n每个sourceKey目录含prompt.txt（完整原文，UTF-8、不改换行）及archive-record.json（原JSONL记录，完整原文位于text字段）。manifest.json有角色、来源、绝对路径及原文SHA256。\n\n这些是用户提供的本地原件，不是转换好的目标站导入XML，也不是验收或任务分配结果。迁移前仍需核对实时库存、人物对应、授权范围与当前运行版本，正常采集公开来源。不要把本目录放入公共代码分享ZIP。\n', { flag: 'wx' });
  await appendFile(join(base, 'timing-runs.jsonl'), JSON.stringify({ observedAt: manifest.observedAt, stage: 'stage-local-rank52-100', elapsedMs: manifest.elapsedMs, category: 'local-extraction-and-hash-verification', browserElapsedMs: 0, userOrSchedulerWaitIncluded: false }) + '\n');
  console.log(JSON.stringify({ output, count: rows.length, allOriginalHashesVerified: true, databaseAccess: false, elapsedMs: manifest.elapsedMs }));
} catch (error) {
  child.kill();
  await exited.catch(() => undefined);
  await writeFile(join(output, 'EXTRACTION-FAILED.json'), JSON.stringify({ observedAt: new Date().toISOString(), error: String(error), extracted: rows.length, complete: false }), { flag: 'wx' });
  throw error;
}
