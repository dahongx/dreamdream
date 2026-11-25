import { readFile, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";

const root = "logs/mufy-profiles/full-20261013/pilot-5";
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
await copyFile(join(root, "manifest.json"), join(root, "manifest-before-rendered-20261015.json"));
for (const row of manifest.rows) {
  const path = join("C:/Users/14343/Downloads", `mufy-opening-${row.roleId}.json`);
  const captured = JSON.parse(await readFile(path, "utf8"));
  if (captured.roleId !== row.roleId) throw Error("Source capture mismatch");
  const snapshot = JSON.parse(await readFile(row.runtimePath, "utf8"));
  const dom = new JSDOM(`<body>${captured.html}</body>`);
  const doc = dom.window.document;
  // The cloud is already adapted as a single floating source component.
  for (const section of doc.querySelectorAll('[data-mufy-source-frame]')) {
    if (section.innerHTML.includes('censy-eternal-nano-cloud')) section.remove();
  }
  for (const e of doc.querySelectorAll('summary')) {
    // +/- pseudo text was captured in its observed state. The native details
    // marker already reflects the actual state; do not freeze a stale sign.
    for (const span of e.querySelectorAll('span')) if (/^[+−-]$/.test(span.textContent?.trim() ?? '')) span.remove();
  }
  captured.html = doc.body.innerHTML;
  captured.greetingSha256 = createHash("sha256").update(snapshot.detail.data.greeting).digest("hex");
  snapshot.renderedOpening = captured;
  const dest = join(root, row.sourceKey, "mufy-runtime-rendered-20261015.json");
  await writeFile(dest, JSON.stringify(snapshot));
  await writeFile(join(root, row.sourceKey, "opening-rendered-20261015.json"), JSON.stringify(captured));
  row.runtimePath = dest;
  console.log(JSON.stringify({name:row.name, renderedBytes:captured.html.length, frameCount:captured.frameCount}));
}
await writeFile(join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
