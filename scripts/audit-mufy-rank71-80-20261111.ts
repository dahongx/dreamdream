import { readFile, writeFile, appendFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { JSDOM } from "jsdom";
import { parseExternalCharacterXml } from "../src/lib/import/external-card";
import { parseMufyPrompt, sha256 } from "../src/lib/import/mufy-migration";

const started = performance.now();
const root = resolve("outputs/mufy-rank71-80-20261111");
const manifest = JSON.parse(await readFile(resolve("outputs/mufy-local-archives-rank52-100-20261109/manifest.json"), "utf8"));
const reports = [];
for (const row of manifest.rows.filter((r: { rank: number }) => r.rank >= 71 && r.rank <= 80 && r.rank !== 74)) {
  const dir = join(root, `rank${row.rank}`);
  const revision = row.rank === 78 ? "prepared-v2" : "prepared";
  const capture = JSON.parse(await readFile(join(dir, "public-capture.json"), "utf8"));
  const audit = JSON.parse(await readFile(join(dir, revision, "audit.json"), "utf8"));
  const xml = await readFile(join(dir, revision, "ui-import.xml"), "utf8");
  const parsed = parseExternalCharacterXml(xml);
  if (!parsed.ok) throw Error(`Rank ${row.rank} XML parse failed`);
  const prompt = await readFile(row.promptPath, "utf8");
  const fields = parseMufyPrompt(prompt);
  const fieldMatches: Record<string, boolean> = {};
  for (const key of ["persona", "adversity", "defaultCognition", "plotSetting", "sampleDialogue"] as const) {
    const normalizedLocal = fields[key]?.replace(/\r\n?/g, "\n") ?? null;
    fieldMatches[key] = parsed.value.character[key] === normalizedLocal;
  }
  const sourceDocuments = capture.documents.map((html: string, index: number) => {
    const document = new JSDOM(html).window.document;
    for (const node of document.querySelectorAll("script,style")) node.remove();
    return { index, htmlCharacters: html.length, visibleTextCharacters: document.body.textContent?.trim().length ?? 0,
      imageCount: document.images.length, buttons: document.querySelectorAll("button").length,
      folds: document.querySelectorAll("details").length,
      media: document.querySelectorAll("audio,video").length };
  });
  const warnings: string[] = [];
  if (capture.observedAt !== audit.observedAt) warnings.push("Canonical capture was replaced after preparation; original source timestamp retained by prepared audit. Confirm version provenance before final acceptance.");
  if (sourceDocuments.some((document: { htmlCharacters: number }) => document.htmlCharacters === 0)) warnings.push("At least one captured iframe document is empty; browser owner must identify its purpose before full component acceptance.");
  if (audit.issues.some((issue: { code: string }) => issue.code === "CSS_SANITIZER_WARNINGS")) warnings.push("CSS sanitizer warnings require actual rendered visual comparison; XML pass is not visual acceptance.");
  reports.push({ rank: row.rank, name: row.name, sourceUrl: row.sourceUrl,
    sourceObservedAt: capture.observedAt, preparedSourceObservedAt: audit.observedAt,
    observedAt: new Date().toISOString(), authorizedPromptHashVerified: sha256(prompt) === row.promptSha256,
    xmlHashVerified: sha256(xml) === audit.xmlSha256, xmlRoundtripVerified: audit.xmlRoundtripVerified,
    fieldMatches, creatorNotePreserved: parsed.value.character.creatorNote === (capture.authorNote.trim() || null),
    fieldLengths: Object.fromEntries(Object.entries(parsed.value.character).filter(([,v]) => typeof v === "string").map(([key, value]) => [key, String(value).length])),
    sourceComponentCount: sourceDocuments.length, sourceDocuments, warnings,
    sourceRulesCaptured: false, fullFidelityAccepted: false,
    note: "Local source, truncation, field and XML audit only. Browser actual interaction and visual acceptance remain pending." });
}
await writeFile(join(root, "prepared-field-resource-audit.json"), JSON.stringify(reports, null, 2));
await appendFile(join(root, "timing-runs.jsonl"), JSON.stringify({kind:"local-process-wall",stage:"prepared-field-resource-audit",observedAt:new Date().toISOString(),elapsedMs:performance.now()-started})+"\n");
console.log(JSON.stringify(reports.map(({rank,fieldMatches,warnings,xmlHashVerified,creatorNotePreserved})=>({rank,fieldMatches,warnings,xmlHashVerified,creatorNotePreserved}))));
