#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
// ASCII JS escapes preserve non-ASCII literals across remote shell/locale boundaries.
for (const [entry, name] of [
  ["scripts/migrate-mufy-card.ts", "migrate-mufy-card.cjs"],
  ["scripts/run-mufy-test-batch.ts", "run-mufy-test-batch.cjs"],
]) {
  const result = await Bun.build({
    entrypoints: [entry],
    target: "node",
    format: "cjs",
  });
  if (!result.success) throw Error(result.logs.map(String).join("\n"));
  const text = await result.outputs[0].text();
  const ascii = text.replace(
    /[^\x00-\x7f]/g,
    (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"),
  );
  await writeFile(
    resolve("logs/mufy-profiles/full-20261013/pilot-5", name),
    ascii,
    "utf8",
  );
  if (name === "migrate-mufy-card.cjs") {
    // Startup-only check: no role and no --commit, so argument validation must
    // reject before reading sources or touching a database. This catches bundled
    // dependencies with missing runtime assets before any TEST upload.
    const smoke = Bun.spawn([process.execPath, resolve("logs/mufy-profiles/full-20261013/pilot-5", name), "--help"], { stdout: "pipe", stderr: "pipe" });
    const stderr = await new Response(smoke.stderr).text();
    const status = await smoke.exited;
    if (status !== 1 || !stderr.includes("缺少 --role"))
      throw new Error("Migration bundle failed startup check before argument validation");
  }
  console.log(JSON.stringify({ name, asciiSafe: true, startupChecked: name === "migrate-mufy-card.cjs" }));
}
