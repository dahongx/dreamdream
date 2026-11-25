import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { assertRenderedOpeningBinding } from "../src/lib/import/mufy-rendered-opening";

const root = "logs/mufy-profiles/full-20261013/pilot-5",
  downloads = "C:/Users/14343/Downloads";
interface RefreshIo {
  read(path: string): Promise<string>;
  list(path: string): Promise<string[]>;
  modified(path: string): Promise<number>;
  write(path: string, content: string): Promise<void>;
}
const diskIo: RefreshIo = {
  read: (path) => readFile(path, "utf8"),
  list: (path) => readdir(path),
  modified: async (path) => (await stat(path)).mtimeMs,
  write: (path, content) => writeFile(path, content),
};

export async function refreshRenderedCaptures(io: RefreshIo = diskIo) {
  const manifest = JSON.parse(await io.read(root + "/manifest.json"));
  if (!Array.isArray(manifest.rows) || manifest.rows.length !== 5)
    throw Error("Expected all five pilot cards before refreshing captures");
  const pending: { path: string; content: string }[] = [];
  const summaries: { name: string; capturedAt: string; bytes: number }[] = [];
  const roles = new Set<string>();
  const destinations = new Set<string>();
  for (const row of manifest.rows) {
    if (
      typeof row.roleId !== "string" ||
      roles.has(row.roleId) ||
      typeof row.runtimePath !== "string" ||
      typeof row.sourceKey !== "string"
    )
      throw Error("Invalid or duplicate pilot source binding");
    roles.add(row.roleId);
    const files = (await io.list(downloads)).filter(
      (n) =>
        n === `mufy-opening-${row.roleId}.json` ||
        new RegExp("^mufy-opening-" + row.roleId + " \\(\\d+\\)\\.json$").test(
          n,
        ),
    );
    const sorted = await Promise.all(
      files.map(async (file) => ({
        file,
        mtime: await io.modified(join(downloads, file)),
      })),
    );
    sorted.sort((a, b) => b.mtime - a.mtime);
    if (!sorted.length) throw Error("Source capture missing");
    const capture = JSON.parse(await io.read(join(downloads, sorted[0].file)));
    if (capture.roleId !== row.roleId) throw Error("Role mismatch");
    const snapshot = JSON.parse(await io.read(row.runtimePath));
    if (
      snapshot.characterId !== row.roleId ||
      typeof snapshot.detail?.data?.greeting !== "string"
    )
      throw Error("Runtime role/greeting mismatch");
    if (typeof capture.html !== "string" || !capture.html.trim())
      throw Error("Rendered opening HTML missing");
    assertRenderedOpeningBinding(
      capture,
      row.roleId,
      snapshot.detail.data.greeting,
    );
    const dom = new JSDOM("<body>" + capture.html + "</body>"),
      doc = dom.window.document;
    for (const section of doc.querySelectorAll("[data-mufy-source-frame]"))
      if (section.innerHTML.includes("censy-eternal-nano-cloud"))
        section.remove();
    function fix(root: ParentNode) {
      for (const e of root.querySelectorAll("*")) {
        for (const a of Array.from(e.attributes))
          if (/^on/i.test(a.name))
            e.setAttribute(
              a.name,
              a.value.replace(/window\.parent\b/g, "window"),
            );
        if (e instanceof dom.window.HTMLTemplateElement) fix(e.content);
      }
    }
    fix(doc.body);
    for (const e of doc.querySelectorAll("summary"))
      for (const span of e.querySelectorAll("span"))
        if (/^[+−-]$/.test(span.textContent?.trim() ?? "")) {
          span.setAttribute("data-mufy-fold-sign", "true");
        }
    capture.html = doc.body.innerHTML;
    snapshot.renderedOpening = capture;
    for (const entry of [
      { path: row.runtimePath, content: JSON.stringify(snapshot) },
      {
        path: join(root, row.sourceKey, "opening-rendered-20261015.json"),
        content: JSON.stringify(capture),
      },
    ]) {
      if (destinations.has(entry.path))
        throw Error("Duplicate refresh output path");
      destinations.add(entry.path);
      pending.push(entry);
    }
    dom.window.close();
    summaries.push({
      name: row.name,
      capturedAt: capture.capturedAt,
      bytes: capture.html.length,
    });
  }
  // All five bindings, parsing, transforms and serialization must succeed before
  // any write. Disk I/O failures are not claimed to be transactionally atomic.
  for (const entry of pending) await io.write(entry.path, entry.content);
  return summaries;
}

async function selfTest() {
  const records = new Map<string, string>();
  const rows = Array.from({ length: 5 }, (_, i) => ({
    roleId: `role-${i}`,
    name: `fixture-${i}`,
    sourceKey: `char-${i}`,
    runtimePath: `runtime-${i}.json`,
  }));
  const files = rows.map((row) => `mufy-opening-${row.roleId}.json`);
  records.set(root + "/manifest.json", JSON.stringify({ rows }));
  for (const row of rows) {
    const greeting = `public greeting ${row.roleId}`;
    const greetingSha256 = createHash("sha256").update(greeting).digest("hex");
    records.set(
      row.runtimePath,
      JSON.stringify({
        characterId: row.roleId,
        detail: { data: { greeting } },
        sourceRules: { retained: true },
        assets: [{ optimization: { retainedGif: true } }],
        userExtension: "preserve",
      }),
    );
    records.set(
      join(downloads, `mufy-opening-${row.roleId}.json`),
      JSON.stringify({
        version: 1,
        roleId: row.roleId,
        capturedAt: "2026-10-15T06:00:00Z",
        greetingSha256,
        sourceBinding: {
          roleId: row.roleId,
          greetingSha256,
          responseCode: 200,
          observedAt: "2026-10-15T05:59:59Z",
        },
        html: '<details><summary><span>+</span>title</summary><p onclick="window.parent.x()">body</p></details>',
        frameCount: 0,
      }),
    );
  }
  const writes: { path: string; content: string }[] = [];
  const io: RefreshIo = {
    read: async (path) => {
      const value = records.get(path);
      if (value === undefined) throw Error("fixture missing");
      return value;
    },
    list: async () => files,
    modified: async () => 1,
    write: async (path, content) => {
      writes.push({ path, content });
    },
  };
  const finalPath = join(downloads, files[4]);
  const validLast = records.get(finalPath);
  assert.ok(validLast, "Fifth fixture capture exists");
  const invalid = JSON.parse(validLast);
  invalid.sourceBinding.greetingSha256 = "wrong-version";
  records.set(finalPath, JSON.stringify(invalid));
  await assert.rejects(
    refreshRenderedCaptures(io),
    /matching normal public detail response binding/,
  );
  assert.equal(
    writes.length,
    0,
    "A fifth-card failure must leave earlier four cards untouched",
  );
  records.set(finalPath, validLast);
  const results = await refreshRenderedCaptures(io);
  assert.equal(results.length, 5);
  assert.equal(writes.length, 10);
  for (const row of rows) {
    const output = writes.find((entry) => entry.path === row.runtimePath);
    assert.ok(output, "Every runtime has one prepared write");
    const updated = JSON.parse(output.content);
    assert.deepEqual(updated.sourceRules, { retained: true });
    assert.deepEqual(updated.assets, [{ optimization: { retainedGif: true } }]);
    assert.equal(updated.userExtension, "preserve");
    assert.match(updated.renderedOpening.html, /data-mufy-fold-sign="true"/);
    assert.match(updated.renderedOpening.html, /window.x\(\)/);
  }
  console.log(
    JSON.stringify({
      selfTest: "pass",
      cases: [
        "fifth-card-binding-failure-zero-writes",
        "five-valid-cards-ten-writes",
        "preserve-source-rules-gif-user-fields-and-transforms",
      ],
      writesToRealFiles: 0,
    }),
  );
}

if (import.meta.main) {
  if (process.argv.includes("--self-test")) await selfTest();
  else
    for (const summary of await refreshRenderedCaptures())
      console.log(JSON.stringify(summary));
}
