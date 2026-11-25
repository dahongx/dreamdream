import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

const dir = "outputs/character-manifest-fix-20261028";
const files = ["package.json", "bun.lock", "patches/next@16.2.6.patch", "scripts/check-character-client-manifest.ts"];
const entries = [];
for (const path of files) {
  const existing = path === "package.json" || path === "bun.lock";
  const result = Bun.spawnSync(["ssh", "-o", "BatchMode=yes", "root@115.29.213.73", existing ? `cat /root/projects/yearn-chat/${path}` : `test ! -e /root/projects/yearn-chat/${path}`]);
  if (result.exitCode) throw new Error(`REMOTE_CONFLICT:${path}`);
  const before = result.stdout.toString();
  let after: string;
  if (path === "package.json") {
    if (!before.includes('"build": "next build --webpack"') || before.includes('"next@16.2.6"')) throw new Error("PACKAGE_CONFLICT");
    after = before.replace('"build": "next build --webpack"', '"build": "next build --webpack && bun scripts/check-character-client-manifest.ts"')
      .replace('"css-tree@3.2.1": "patches/css-tree@3.2.1.patch"', '"css-tree@3.2.1": "patches/css-tree@3.2.1.patch",\n    "next@16.2.6": "patches/next@16.2.6.patch"');
  } else if (path === "bun.lock") {
    if (before.includes('"next@16.2.6": "patches')) throw new Error("LOCK_CONFLICT");
    after = before.replace('"patchedDependencies": {', '"patchedDependencies": {\n    "next@16.2.6": "patches/next@16.2.6.patch",');
  } else after = await readFile(path, "utf8");
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  await mkdir(dirname(`${dir}/patch/${path}`), { recursive: true });
  await writeFile(`${dir}/patch/${path}`, after);
  entries.push({ path, before: existing ? hash(before) : null, after: hash(after) });
}
await writeFile(`${dir}/manifest.json`, JSON.stringify({ target: "TEST-8091", entries }, null, 2));
console.log("Prepared isolated manifest fix against current TEST files");
