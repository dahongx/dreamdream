/** Authorized 8091-only visual compatibility deployment. No database commands. */
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
if (!process.argv.includes("--commit-test")) throw Error("--commit-test required");
const files = ["src/components/chat/MessageRenderer.tsx", "src/components/chat/MessageBubble.tsx", "src/components/chat/mufy-native-table.module.css", "src/lib/import/mufy-native-table.ts"];
const baselines = ["fe8ddad7a850677cf2a0e425b5277202dab5b2ed56fd30d620a0e541dc3384e3", "f5be44a2a883bbd8a973ba1415ebbfa88072b2c9a133963ed9309a33f9c20a45"];
const root = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const startedAt = new Date().toISOString(), start = performance.now(), stamp = startedAt.replace(/\D/g, "");
const backup = `/root/mufy-transfer-archive-20261015/native-table-${stamp}`;
const ssh = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "root@115.29.213.73"];
const digest = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
async function run(args: string[], capture = false) {
  const p = Bun.spawn(args, { stdout: capture ? "pipe" : "inherit", stderr: "inherit" });
  const text = capture ? await new Response(p.stdout).text() : "";
  if (await p.exited) throw Error(`TEST command failed: ${args[0]}`);
  return text;
}
let ok = false;
try {
 await requireTestDiskCapacity(run,ssh);
  const port = await run([...ssh, "cd /root/projects/yearn-chat && docker compose port app 3000"], true);
  if (!/^0\.0\.0\.0:8091\s*$/m.test(port)) throw Error("EXACT_TEST_PORT_REQUIRED");
  // Strip exactly this change and require the reviewed remote baseline. Never
  // publish unrelated local dirty-worktree changes over the live renderer.
  const renderer = (await readFile(files[0], "utf8")).replaceAll("\r\n", "\n");
  const bubble = (await readFile(files[1], "utf8")).replaceAll("\r\n", "\n");
  const oldRenderer = renderer
    .replace('import { needsMufyLightTableRows } from "@/lib/import/mufy-native-table";\n', "")
    .replace('import mufyTableStyles from "./mufy-native-table.module.css";\n', "")
    .replace(/\nconst MUFY_COMPONENTS: Components = \{[\s\S]*?\n\};\n/, "")
    .replace('  /** Public source-platform defaults only, not arbitrary author CSS. */\n  mufySourceDefaults?: boolean;\n', "")
    .replace('  mufySourceDefaults = false,\n', "")
    .replace('components={mufySourceDefaults ? MUFY_COMPONENTS : SEMANTIC_COMPONENTS}', 'components={SEMANTIC_COMPONENTS}');
  const oldBubble = bubble
    .replace('import { hasMufyRenderedOpening } from "@/lib/import/mufy-native-table";\n', "")
    .replace('  const mufySourceDefaults = useMemo(() => hasMufyRenderedOpening(rules), [rules]);\n', "")
    .replace('                  mufySourceDefaults={mufySourceDefaults}\n', "");
  if (digest(oldRenderer) !== baselines[0] || digest(oldBubble) !== baselines[1]) throw Error("UNRELATED_LOCAL_RENDERER_CHANGES_REFUSED");
  for (const [i, file] of files.slice(0, 2).entries()) {
    const actual = await run([...ssh, `cd /root/projects/yearn-chat && sha256sum ${file}`], true);
    if (actual.split(/\s/)[0] !== baselines[i]) throw Error("REMOTE_CHANGED_REFUSING_OVERWRITE");
  }
  const retryIndex = process.argv.indexOf("--retry-report");
  if (retryIndex >= 0) {
    const path = resolve(process.argv[retryIndex + 1]);
    const previous = JSON.parse(await readFile(path, "utf8"));
    if (!path.startsWith(root + "/") && !path.startsWith(root + "\\")) throw Error("RETRY_REPORT_OUTSIDE_JOB");
    if (previous.scope !== "TEST" || previous.port !== 8091 || previous.ok !== false || JSON.stringify(previous.files) !== JSON.stringify(files)) throw Error("FAILED_TEST_REPORT_REQUIRED");
    for (const file of files.slice(2)) {
      const priorBytes = await run(["tar", "-xOf", path.replace(/\.json$/, ".tar"), file], true);
      const actual = await run([...ssh, `cd /root/projects/yearn-chat && sha256sum ${file}`], true);
      if (actual.split(/\s/)[0] !== digest(priorBytes)) throw Error("RETRY_ADDITION_CHANGED_REFUSING_OVERWRITE");
    }
  } else await run([...ssh, `cd /root/projects/yearn-chat && test ! -e ${files[2]} && test ! -e ${files[3]}`]);
  const archive = resolve(root, `native-table-${stamp}.tar`);
  await run(["tar", "-cf", archive, ...files]);
  await run([...ssh, `umask 077; mkdir -p ${backup}`]);
  await run(["scp", "-q", archive, `root@115.29.213.73:${backup}/patch.tar`]);
  await run([...ssh, `set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files[0]} ${files[1]}; docker tag yearn-chat-app yearn-chat-app:native-table-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 45 ${backup}/build.log; exit 1; fi; docker compose ps app --format '{{.State}} {{.Ports}}'`]);
  ok = true;
} finally {
  const report = { scope:"TEST", port:8091, startedAt, finishedAt:new Date().toISOString(), elapsedMs:performance.now()-start, ok, files, baselines, backup, databaseCommands:0, productionWrites:0, visualAccepted:false };
  await writeFile(resolve(root, `native-table-${stamp}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
