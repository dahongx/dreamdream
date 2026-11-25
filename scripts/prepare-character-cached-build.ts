import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const dir = "outputs/character-manifest-fix-20261028";
function remote(command: string) {
  const p = Bun.spawnSync(["ssh", "-o", "BatchMode=yes", "root@115.29.213.73", command]);
  if (p.exitCode) throw new Error("REMOTE_READ_FAILED");
  return p.stdout.toString();
}
const image = remote("docker inspect yearn-chat-app-1 --format '{{.Image}}'").trim();
if (image !== "sha256:1c66d22c020167903ba558cbabd0297fbf1ff7a10fe54d0590a59d3ecad114d7") throw new Error("BASE_CHANGED");
const installed = JSON.parse(remote("docker exec yearn-chat-app-1 cat package.json"));
const candidate = JSON.parse(await readFile(`${dir}/patch/package.json`, "utf8"));
for (const key of ["dependencies", "devDependencies"]) {
  if (JSON.stringify(installed[key]) !== JSON.stringify(candidate[key])) throw new Error(`DEPENDENCIES_CHANGED:${key}`);
}
const original = remote("cat /root/projects/yearn-chat/Dockerfile");
const old = "FROM oven/bun:${BUN_VERSION} AS deps";
if (!original.includes(old) || !original.includes("RUN bun install --frozen-lockfile")) throw new Error("DOCKERFILE_CHANGED");
const fix = `const fs=require("node:fs");if(require("/app/node_modules/next/package.json").version!=="16.2.6")throw Error("NEXT_VERSION");for(const prefix of ["dist","dist/esm"]){const p="/app/node_modules/next/"+prefix+"/build/webpack/plugins/flight-manifest-plugin.js";const s=fs.readFileSync(p,"utf8");const old="if (concatenatedModId) {";if(s.split(old).length!==2)throw Error("PATCH_CONFLICT");fs.writeFileSync(p,s.replace(old,"if (concatenatedModId !== null && concatenatedModId !== undefined) {"));}`;
const patched = original.replace(old, `FROM ${image} AS deps`).replace("RUN bun install --frozen-lockfile", `RUN bun -e '${fix}'`);
await writeFile(`${dir}/cached.Dockerfile`, patched);
await writeFile(`${dir}/cached-build.json`, JSON.stringify({ image, originalDockerfileHash: createHash("sha256").update(original).digest("hex") }));
console.log("Verified unchanged dependencies; prepared pinned-image cached build");
