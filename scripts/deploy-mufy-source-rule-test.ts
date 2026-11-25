#!/usr/bin/env bun
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
import { appendFile, mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

if (!process.argv.includes("--commit-test")) throw new Error("--commit-test required");
const startedAt = new Date().toISOString(), start = performance.now();
const stamp = startedAt.replace(/\D/g, "");
const root = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const destination = `/root/mufy-transfer-archive-20261015/source-rules-${stamp}`;
const host = "root@115.29.213.73";
const files = ["src/lib/regex/segments.ts", "src/lib/regex/apply.ts", "src/lib/import/mufy-source-rules.ts", "src/lib/import/mufy-source-rule-envelope.ts"];
const baselineAt = process.argv.indexOf("--baseline-archive");
const baselineArchive = baselineAt < 0 ? undefined : resolve(process.argv[baselineAt + 1]);
if (baselineArchive && !baselineArchive.startsWith(root + "\\")) throw new Error("Baseline archive must belong to this exact job");
if (baselineArchive) files.push("src/components/chat/MessageBubble.tsx");
const archive = resolve(root, `source-rules-deploy-${stamp}.tar`);
const ssh = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host];
async function run(args: string[], capture = false): Promise<string> {
  const child = Bun.spawn(args, { stdout: capture ? "pipe" : "inherit", stderr: "inherit" });
  const output = capture ? await new Response(child.stdout).text() : "";
  if (await child.exited) throw new Error(`TEST deployment command failed: ${args[0]}`);
  return output;
}
let ok = false;
try {
 await requireTestDiskCapacity(run,ssh);
  await mkdir(root, { recursive: true });
  const port = await run([...ssh, "cd /root/projects/yearn-chat && docker compose port app 3000"], true);
  if (!/^0\.0\.0\.0:8091\s*$/m.test(port)) throw new Error("Not the exact TEST 8091 app");
  // The two existing files were read-only checked before this deployment.
  // Refuse to overwrite someone else's edits or a concurrent deployment.
  if (baselineArchive) {
    for (const file of files.slice(0, 4)) {
      const prior = await run(["tar", "-xOf", baselineArchive, file], true);
      const expected = createHash("sha256").update(prior).digest("hex");
      const actual = await run([...ssh, `cd /root/projects/yearn-chat && sha256sum ${file}`], true);
      if (actual.split(/\s/)[0] !== expected) throw new Error(`Remote source changed: ${file}`);
    }
    const file = files[4];
    const prior = await run([...ssh, `cd /root/projects/yearn-chat && cat ${file}`], true);
    const next = await readFile(file, "utf8");
    const normalized = (text: string) => text.replace(/\r\n/g, "\n");
    if (normalized(prior) !== normalized(next) && normalized(prior) !== normalized(next).replace(/^\s*minHeight=\{seg\.minHeight\}\n/m, "")) throw new Error("MessageBubble has changes beyond the reviewed one-line height fix");
  } else {
    await run([...ssh, "cd /root/projects/yearn-chat && test \"$(sha256sum src/lib/regex/segments.ts | cut -d' ' -f1)\" = d473c1087c4791a9438ffb5c622c9d189f29d0a1c8ee763c535c3af32bf423a4 && test \"$(sha256sum src/lib/regex/apply.ts | cut -d' ' -f1)\" = f23d318f758de30e1dd3bf0f2e3bdd6a5159ec832449fa366f7ec680ad235a8d && test ! -e src/lib/import/mufy-source-rules.ts && test ! -e src/lib/import/mufy-source-rule-envelope.ts"]);
  }
  await run(["tar", "-cf", archive, ...files]);
  await run([...ssh, `umask 077; mkdir -p ${destination}`]);
  await run(["scp", "-q", archive, `${host}:${destination}/upload.tar`]);
  await run([...ssh, `set -e; cd /root/projects/yearn-chat; tar -cf ${destination}/source-before.tar ${baselineArchive ? files.join(" ") : files.slice(0, 2).join(" ")}; docker tag yearn-chat-app yearn-chat-app:mufy-source-before-${stamp}; tar -xf ${destination}/upload.tar; if docker compose build app >${destination}/build.log 2>&1; then docker compose up -d --no-deps app; else tail -n 70 ${destination}/build.log; exit 1; fi; docker compose ps app --format '{{.State}} {{.Ports}}'`]);
  ok = true;
} finally {
  const result = { version: 1, scope: "TEST", port: 8091, startedAt, finishedAt: new Date().toISOString(), measuredExecutionMs: performance.now() - start, ok, files, remoteBackup: destination, previousImageTag: `yearn-chat-app:mufy-source-before-${stamp}`, productionWrites: 0 };
  await writeFile(resolve(root, `source-rules-deploy-${stamp}.json`), JSON.stringify(result, null, 2));
  await appendFile(resolve(root, "repair-execution.jsonl"), JSON.stringify({ ...result, session: "20261015T040452Z", label: "source-rule-test-renderer-deployment", exitCode: ok ? 0 : 1, excludes: ["user pauses", "development outside this command"] }) + "\n");
}
