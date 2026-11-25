#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  type RuntimeVisualSnapshot,
  verifyMufyVisualAcceptance,
} from "../src/lib/import/mufy-visual-acceptance";

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const sourcePath = argument("--source");
  const targetPath = argument("--target");
  if (!sourcePath || !targetPath) {
    throw new Error(
      "用法：bun run mufy:verify -- --source <Mufy运行态.json> --target <寄情运行态.json> [--report <验收报告.json>]",
    );
  }
  const [sourceText, targetText] = await Promise.all([
    readFile(resolve(sourcePath), "utf8"),
    readFile(resolve(targetPath), "utf8"),
  ]);
  const source = JSON.parse(sourceText) as RuntimeVisualSnapshot;
  const target = JSON.parse(targetText) as RuntimeVisualSnapshot;
  const result = verifyMufyVisualAcceptance(source, target);
  const report = {
    ...result,
    generatedAt: new Date().toISOString(),
    sourcePath: resolve(sourcePath),
    targetPath: resolve(targetPath),
    sourceCharacterId: source.characterId ?? null,
    targetCharacterId: target.characterId ?? null,
  };
  const reportPath = argument("--report");
  if (reportPath) {
    const absolute = resolve(reportPath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(report, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
