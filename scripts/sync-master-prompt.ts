import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type LiteralPiece = ["l", string];
type UnitPiece = ["u", string];
type SectionPiece = ["s", string];
type TemplatePiece = LiteralPiece | UnitPiece | SectionPiece;

interface MasterTemplate {
  template_id: string;
  source_chars: number;
  name_slot_count: number;
  unit_ref_count: number;
  prompt_count: number;
  source_master_template_id: string;
  translation_target: string;
  pieces: TemplatePiece[];
}

interface ConsolidationStats {
  schema_version: string;
  policy_version: string;
  status: string;
  source_master_template_id: string;
  master_template_id: string;
  master_selection: string;
  prompt_count: number;
  immediate_reconstruction_verified_records: number;
  persisted_reconstruction_verified_records: number;
}

interface EnglishStats {
  locale: string;
  policy_version: string;
  validated_units: number;
  residual_cjk_units: number;
}

interface TranslationUnitRow {
  source_text: string;
}

interface TranslationRow {
  translated_text: string;
}

interface LegacyTemplateStatsRow {
  prompt_count: number;
  first_seen: string | null;
  last_seen: string | null;
}

const EXPECTED_SECTIONS = [
  "CharaPrompt",
  "Greeting",
  "OutputSetting",
  "StyleSamples",
  "PlotSetting",
  "SupplementalContext",
] as const;
/**
 * 上游快照里的角色名占位符原文。仓库内的资产统一改写成
 * {@link CHARACTER_NAME_TOKEN}（见 normalizeToken），两者是 1:1 改名，
 * 不影响 name_slot_count 与重建校验。
 */
const UPSTREAM_CHARACTER_NAME_TOKEN = "⟦MUFY_CHARACTER_NAME⟧";
const CHARACTER_NAME_TOKEN = "⟦CHARACTER_NAME⟧";
const DEFAULT_SOURCE_ROOT = resolve(
  process.cwd(),
  "../prompt-source/prompt-blocks-single-template",
);
const DESTINATION_ROOT = resolve(
  process.cwd(),
  "src/lib/ai/prompts/single-master-v1",
);

/** 把上游占位符改名成仓库内的中性 token。 */
function normalizeToken(value: string): string {
  return value.replaceAll(UPSTREAM_CHARACTER_NAME_TOKEN, CHARACTER_NAME_TOKEN);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function countOccurrences(value: string, needle: string): number {
  if (!needle) return 0;
  return value.split(needle).length - 1;
}

function renderTemplate(
  pieces: TemplatePiece[],
  units: Readonly<Record<string, string>>,
): string {
  return pieces
    .map((piece) => {
      if (piece[0] === "l") return piece[1];
      if (piece[0] === "s") return `⟦ROLE_SECTION:${piece[1]}⟧`;
      const value = units[piece[1]];
      assert(value !== undefined, `missing translation unit ${piece[1]}`);
      return value;
    })
    .join("");
}

function argumentValue(name: string): string | undefined {
  const index = Bun.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = Bun.argv[index + 1];
  assert(value && !value.startsWith("--"), `${name} requires a value`);
  return value;
}

async function readUtf8(path: string): Promise<string> {
  const file = Bun.file(path);
  assert(await file.exists(), `missing source artifact: ${path}`);
  return file.text();
}

async function writeOrCheck(path: string, content: string, check: boolean) {
  if (check) {
    const current = await readUtf8(path);
    assert(current === content, `generated prompt asset is stale: ${path}`);
    return;
  }
  await Bun.write(path, content);
}

async function main() {
  const check = Bun.argv.includes("--check");
  const sourceRoot = resolve(argumentValue("--source") ?? DEFAULT_SOURCE_ROOT);
  const masterPath = join(sourceRoot, "master_template.json");
  const databasePath = join(sourceRoot, "prompt_blocks.sqlite3");
  const statsPath = join(sourceRoot, "stats.json");
  const englishStatsPath = join(sourceRoot, "master_template.en.stats.json");
  const englishRenderedPath = join(sourceRoot, "master_template.en.md");

  const [masterRaw, statsRaw, englishStatsRaw, englishRendered] =
    await Promise.all([
      readUtf8(masterPath),
      readUtf8(statsPath),
      readUtf8(englishStatsPath),
      readUtf8(englishRenderedPath),
    ]);
  const master = parseJson<MasterTemplate>(masterRaw, "master_template.json");
  const stats = parseJson<ConsolidationStats>(statsRaw, "stats.json");
  const englishStats = parseJson<EnglishStats>(
    englishStatsRaw,
    "master_template.en.stats.json",
  );

  assert(stats.schema_version === "2", "unsupported prompt schema");
  assert(
    stats.status === "ready_for_translation_provider",
    "source package is not ready",
  );
  assert(
    master.template_id === stats.master_template_id,
    "template ID mismatch",
  );
  assert(
    master.source_master_template_id === stats.source_master_template_id,
    "source template ID mismatch",
  );
  assert(master.prompt_count === stats.prompt_count, "prompt count mismatch");
  assert(
    stats.immediate_reconstruction_verified_records === stats.prompt_count &&
      stats.persisted_reconstruction_verified_records === stats.prompt_count,
    "source package has not passed complete reconstruction verification",
  );
  assert(englishStats.locale === "en", "English master locale mismatch");
  assert(
    englishStats.policy_version === "single-master-en-v1",
    "unexpected English translation policy",
  );
  assert(
    englishStats.residual_cjk_units === 0,
    "English master still contains residual CJK units",
  );

  const sectionNames = master.pieces
    .filter((piece): piece is SectionPiece => piece[0] === "s")
    .map((piece) => piece[1]);
  assert(
    JSON.stringify(sectionNames) === JSON.stringify(EXPECTED_SECTIONS),
    `unexpected role section contract: ${sectionNames.join(", ")}`,
  );

  const unitIds = [
    ...new Set(
      master.pieces
        .filter((piece): piece is UnitPiece => piece[0] === "u")
        .map((piece) => piece[1]),
    ),
  ];
  assert(
    unitIds.length === master.unit_ref_count,
    "master unit count mismatch",
  );
  assert(
    unitIds.length === englishStats.validated_units,
    "validated English unit count mismatch",
  );

  // The captured database uses WAL mode without shipping transient -shm/-wal
  // files. `immutable=1` keeps this importer rigorously read-only while still
  // allowing SQLite to query the offline snapshot.
  const database = new Database(
    `${pathToFileURL(databasePath).href}?immutable=1`,
    { readonly: true, strict: true },
  );
  const sourceQuery = database.query<TranslationUnitRow, [string]>(
    "SELECT source_text FROM translation_units WHERE unit_id = ?",
  );
  const englishQuery = database.query<TranslationRow, [string, string, string]>(
    `SELECT translated_text
       FROM translations
      WHERE unit_id = ?
        AND locale = ?
        AND policy_version = ?
        AND validation_status = 'validated'`,
  );
  const legacyStatsQuery = database.query<LegacyTemplateStatsRow, [string]>(
    `SELECT COUNT(*) AS prompt_count,
            MIN(first_seen) AS first_seen,
            MAX(first_seen) AS last_seen
       FROM prompts
      WHERE legacy_template_id = ?`,
  );

  const sourceUnits: Record<string, string> = {};
  const englishUnits: Record<string, string> = {};
  for (const unitId of unitIds) {
    const sourceRow = sourceQuery.get(unitId);
    const englishRow = englishQuery.get(
      unitId,
      englishStats.locale,
      englishStats.policy_version,
    );
    assert(sourceRow, `missing canonical source unit ${unitId}`);
    assert(englishRow, `missing validated English unit ${unitId}`);
    sourceUnits[unitId] = normalizeToken(sourceRow.source_text);
    englishUnits[unitId] = normalizeToken(englishRow.translated_text);
  }
  const legacyStats = legacyStatsQuery.get(master.source_master_template_id);
  database.close();
  assert(legacyStats, "missing legacy template deployment statistics");

  const renderedSource = renderTemplate(master.pieces, sourceUnits);
  const renderedEnglish = renderTemplate(master.pieces, englishUnits);
  assert(
    renderedEnglish === normalizeToken(englishRendered),
    "structured English reconstruction differs from reviewed master_template.en.md",
  );
  assert(
    countOccurrences(renderedSource, CHARACTER_NAME_TOKEN) ===
      master.name_slot_count,
    "source character-name slot count mismatch",
  );
  assert(
    countOccurrences(renderedEnglish, CHARACTER_NAME_TOKEN) ===
      master.name_slot_count,
    "English character-name slot count mismatch",
  );

  const pieceCounts = master.pieces.reduce<Record<TemplatePiece[0], number>>(
    (counts, piece) => {
      counts[piece[0]] += 1;
      return counts;
    },
    { l: 0, u: 0, s: 0 },
  );
  const provenance = {
    schemaVersion: 1,
    canonicalPolicyVersion: stats.policy_version,
    englishPolicyVersion: englishStats.policy_version,
    templateId: master.template_id,
    sourceTemplateId: master.source_master_template_id,
    selectionRule: stats.master_selection,
    sourceArtifactPath: "prompt-blocks-single-template/master_template.json",
    templateSha256: sha256(masterRaw),
    bundleSha256: sha256(JSON.stringify([master, sourceUnits, englishUnits])),
    renderedSourceSha256: sha256(renderedSource),
    renderedEnglishSha256: sha256(renderedEnglish),
    promptCount: master.prompt_count,
    sourceTemplateDeploymentCount: legacyStats.prompt_count,
    sourceTemplateFirstSeen: legacyStats.first_seen,
    sourceTemplateLastSeen: legacyStats.last_seen,
    reconstructionVerified: {
      immediate: stats.immediate_reconstruction_verified_records,
      persisted: stats.persisted_reconstruction_verified_records,
    },
    pieceCounts,
    unitCount: unitIds.length,
    characterNameSlotCount: master.name_slot_count,
    roleSections: EXPECTED_SECTIONS,
    runtimeInstructionLocales: ["zh-Hans", "en"],
  } as const;

  await mkdir(DESTINATION_ROOT, { recursive: true });
  await Promise.all([
    writeOrCheck(
      join(DESTINATION_ROOT, "master-template.json"),
      masterRaw,
      check,
    ),
    writeOrCheck(
      join(DESTINATION_ROOT, "master-units.zh-Hans.json"),
      `${JSON.stringify(sourceUnits, null, 2)}\n`,
      check,
    ),
    writeOrCheck(
      join(DESTINATION_ROOT, "master-units.en.json"),
      `${JSON.stringify(englishUnits, null, 2)}\n`,
      check,
    ),
    writeOrCheck(
      join(DESTINATION_ROOT, "provenance.json"),
      `${JSON.stringify(provenance, null, 2)}\n`,
      check,
    ),
  ]);

  console.log(
    `${check ? "Verified" : "Synced"} canonical prompt ${master.template_id} (${unitIds.length} units, ${master.prompt_count} verified cards)`,
  );
}

await main();
