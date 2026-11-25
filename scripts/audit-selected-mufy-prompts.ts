#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SECTION_TAGS = [
  "CharaPrompt",
  "AdversityHandling",
  "DefaultCognition",
  "Greeting",
  "OutputSetting",
  "StyleSamples",
  "PlotSetting",
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

function extractSection(prompt: string, tag: string) {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const closeIndex = prompt.indexOf(close);
  const openIndex = prompt.lastIndexOf(open, closeIndex);
  if (openIndex < 0 || closeIndex < openIndex) return null;
  const contentStart = openIndex + open.length;
  const content = prompt.slice(contentStart, closeIndex);
  return {
    tag,
    openIndex,
    contentStart,
    closeIndex,
    endIndex: closeIndex + close.length,
    length: content.length,
    byteLength: Buffer.byteLength(content),
    sha256: sha256(content),
    content,
  };
}

function compactContext(value: string, index: number, width = 120): string {
  return value
    .slice(Math.max(0, index - width), Math.min(value.length, index + width))
    .replaceAll(/\s+/g, " ")
    .trim();
}

const inputPath = resolve(
  argumentValue("--input") ?? "selected_character_prompts(1).json",
);
const reportPath = resolve(
  argumentValue("--report") ??
    "logs/card-imports/mufy-selected-20260824/prompt-completeness-audit.json",
);
const raw = await Bun.file(inputPath).text();
const source = JSON.parse(raw);

const records = source.characters.map((record: Record<string, unknown>) => {
  const prompt = typeof record.prompt === "string" ? record.prompt : null;
  if (!prompt) {
    return {
      characterName: record.character_name,
      found: record.found,
      sourceKeys: Object.keys(record),
      prompt: null,
      note: record.note ?? null,
      referencedIn: record.referenced_in ?? null,
    };
  }

  const sections = SECTION_TAGS.map((tag) => extractSection(prompt, tag))
    .filter((section) => section !== null)
    .sort((a, b) => a.openIndex - b.openIndex);
  const intervals = sections.map((section) => [
    section.openIndex,
    section.endIndex,
  ]);
  const unmapped: Array<{
    start: number;
    end: number;
    length: number;
    sha256: string;
    preview: string;
  }> = [];
  let cursor = 0;
  for (const [start, end] of intervals) {
    if (start > cursor) {
      const content = prompt.slice(cursor, start);
      unmapped.push({
        start: cursor,
        end: start,
        length: content.length,
        sha256: sha256(content),
        preview: content.replaceAll(/\s+/g, " ").trim().slice(0, 300),
      });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < prompt.length) {
    const content = prompt.slice(cursor);
    unmapped.push({
      start: cursor,
      end: prompt.length,
      length: content.length,
      sha256: sha256(content),
      preview: content.replaceAll(/\s+/g, " ").trim().slice(0, 300),
    });
  }

  const urls = [...new Set(prompt.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [])];
  const tagNames = [
    ...new Set(
      [...prompt.matchAll(/<\/?([^\s<>/]+)(?:\s[^<>]*)?>/g)].map(
        (match) => match[1],
      ),
    ),
  ].sort();
  const classes = [
    ...new Set(
      [...prompt.matchAll(/class\s*=\s*["']([^"']+)["']/gi)].flatMap((match) =>
        match[1].split(/\s+/).filter(Boolean),
      ),
    ),
  ].sort();
  const ids = [
    ...new Set(
      [...prompt.matchAll(/id\s*=\s*["']([^"']+)["']/gi)].map(
        (match) => match[1],
      ),
    ),
  ].sort();
  const storageAccesses = [
    ...prompt.matchAll(
      /localStorage\.(getItem|setItem|removeItem)\(\s*([^,)]+)/g,
    ),
  ].map((match) => {
    const expression = match[2].trim();
    const literal = /^["']([^"']+)["']$/.exec(expression)?.[1] ?? null;
    const variable = /^[A-Za-z_$][\w$]*$/.test(expression) ? expression : null;
    const escapedVariable = variable?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const resolved = escapedVariable
      ? (new RegExp(
          `(?:const|let|var)\\s+${escapedVariable}\\s*=\\s*["']([^"']+)["']`,
        ).exec(prompt)?.[1] ?? null)
      : null;
    return {
      method: match[1],
      expression,
      resolvedKey: literal ?? resolved,
      start: match.index,
    };
  });
  const storageKeys = [
    ...new Set(
      storageAccesses
        .map((access) => access.resolvedKey)
        .filter((key) => key !== null),
    ),
  ].sort();
  const codeFences = [
    ...prompt.matchAll(/```([^\n\r]*)\r?\n([\s\S]*?)```/g),
  ].map((match, index) => ({
    index,
    language: match[1].trim() || null,
    start: match.index,
    length: match[2].length,
    sha256: sha256(match[2]),
  }));
  const styleBlocks = [
    ...prompt.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
  ].map((match, index) => ({
    index,
    start: match.index,
    length: match[1].length,
    sha256: sha256(match[1]),
  }));
  const scriptBlocks = [
    ...prompt.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((match, index) => ({
    index,
    start: match.index,
    length: match[1].length,
    sha256: sha256(match[1]),
  }));
  const assetUrls = urls.filter((url) =>
    /\.(?:png|jpe?g|webp|gif|svg|mp3|wav|ogg|m4a)(?:[?#]|$)/i.test(url),
  );
  const declaredLength =
    typeof record.source_length === "number" ? record.source_length : null;
  const computedHash = sha256(prompt);

  return {
    characterName: record.character_name,
    found: record.found,
    sourceKeys: Object.keys(record),
    metadata: {
      matchType: record.match_type ?? null,
      characterKey: record.character_key ?? null,
      aliases: record.character_aliases ?? null,
      canonicalPromptHash: record.canonical_prompt_hash ?? null,
      variantCount: record.variant_count ?? null,
      nameMethods: record.name_methods ?? null,
      firstSeen: record.first_seen ?? null,
    },
    prompt: {
      declaredLength,
      characterLength: prompt.length,
      byteLength: Buffer.byteLength(prompt),
      declaredLengthMatches: declaredLength === prompt.length,
      sha256: computedHash,
      canonicalHashMatches: record.canonical_prompt_hash === computedHash,
    },
    sections: sections.map(({ content: _content, ...section }) => section),
    unmappedSegments: unmapped,
    coverage: {
      mappedCharacters: sections.reduce(
        (sum, section) => sum + (section.endIndex - section.openIndex),
        0,
      ),
      unmappedCharacters: unmapped.reduce(
        (sum, segment) => sum + segment.length,
        0,
      ),
      totalCharacters: prompt.length,
    },
    structures: {
      tagNames,
      classCount: classes.length,
      classes,
      idCount: ids.length,
      ids,
      codeFences,
      styleBlocks,
      scriptBlocks,
      localStorageAccesses: storageAccesses,
      localStorageKeys: storageKeys,
      detailsCount: countMatches(prompt, /<details\b/gi),
      summaryCount: countMatches(prompt, /<summary\b/gi),
      htmlDocumentCount: countMatches(prompt, /<!doctype\s|<html[\s>]/gi),
      placeholderCount: countMatches(
        prompt,
        /\{\{[^{}]+\}\}|\[(?:AI|ai)填充[^\]]*\]/g,
      ),
      commandCount: countMatches(prompt, /(^|\n)\s*\$/g),
    },
    resources: {
      urlCount: urls.length,
      urls,
      assetUrlCount: assetUrls.length,
      assetUrls,
      urlContexts: urls.map((url) => ({
        url,
        context: compactContext(prompt, prompt.indexOf(url)),
      })),
    },
  };
});

const report = {
  version: 2,
  generatedAt: new Date().toISOString(),
  input: {
    path: inputPath,
    byteLength: Buffer.byteLength(raw),
    sha256: sha256(raw),
    rootKeys: Object.keys(source),
    requestedCount: source.requested_count,
    foundCount: source.found_count,
    selectionRule: source.selection_rule,
    recordCount: source.characters.length,
  },
  records,
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      reportPath,
      input: report.input,
      records: records.map((record) => ({
        name: record.characterName,
        found: record.found,
        prompt: record.prompt,
        sections: record.sections?.map((section: Record<string, unknown>) => ({
          tag: section.tag,
          length: section.length,
        })),
        unmappedSegments: record.unmappedSegments?.length ?? 0,
        structures: record.structures
          ? {
              codeFences: record.structures.codeFences.length,
              styleBlocks: record.structures.styleBlocks.length,
              scriptBlocks: record.structures.scriptBlocks.length,
              details: record.structures.detailsCount,
              classes: record.structures.classCount,
              assets: record.resources.assetUrlCount,
            }
          : null,
      })),
    },
    null,
    2,
  ),
);
