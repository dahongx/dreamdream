import { createHash } from "node:crypto";
import type { MasterInstructionLocale } from "./conversation-locale";
import masterTemplateJson from "./prompts/single-master-v1/master-template.json";
import englishUnitsJson from "./prompts/single-master-v1/master-units.en.json";
import sourceUnitsJson from "./prompts/single-master-v1/master-units.zh-Hans.json";
import provenanceJson from "./prompts/single-master-v1/provenance.json";

export const MASTER_ROLE_SECTIONS = [
  "CharaPrompt",
  "Greeting",
  "OutputSetting",
  "StyleSamples",
  "PlotSetting",
  "SupplementalContext",
] as const;

export type MasterRoleSection = (typeof MASTER_ROLE_SECTIONS)[number];
type TemplatePiece = ["l" | "u" | "s", string];

interface MasterTemplateAsset {
  template_id: string;
  source_master_template_id: string;
  name_slot_count: number;
  unit_ref_count: number;
  prompt_count: number;
  pieces: TemplatePiece[];
}

interface MasterPromptProvenance {
  schemaVersion: 1;
  canonicalPolicyVersion: string;
  englishPolicyVersion: string;
  templateId: string;
  sourceTemplateId: string;
  templateSha256: string;
  bundleSha256: string;
  renderedSourceSha256: string;
  renderedEnglishSha256: string;
  promptCount: number;
  pieceCounts: { l: number; u: number; s: number };
  unitCount: number;
  characterNameSlotCount: number;
  roleSections: string[];
}

const CHARACTER_NAME_TOKEN = "⟦CHARACTER_NAME⟧";
const masterTemplate = masterTemplateJson as unknown as MasterTemplateAsset;
const provenance = provenanceJson as MasterPromptProvenance;
const unitsByLocale: Record<
  MasterInstructionLocale,
  Readonly<Record<string, string>>
> = {
  "zh-Hans": sourceUnitsJson,
  en: englishUnitsJson,
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid canonical prompt asset: ${message}`);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validateAssets() {
  assert(
    masterTemplate.template_id === provenance.templateId,
    "template ID mismatch",
  );
  assert(
    masterTemplate.source_master_template_id === provenance.sourceTemplateId,
    "source template ID mismatch",
  );
  assert(
    masterTemplate.prompt_count === provenance.promptCount,
    "prompt count mismatch",
  );
  assert(
    masterTemplate.name_slot_count === provenance.characterNameSlotCount,
    "character-name slot count mismatch",
  );
  assert(
    masterTemplate.unit_ref_count === provenance.unitCount,
    "unit count mismatch",
  );
  assert(
    sha256(
      JSON.stringify([masterTemplateJson, sourceUnitsJson, englishUnitsJson]),
    ) === provenance.bundleSha256,
    "bundle checksum mismatch",
  );

  const sections = masterTemplate.pieces
    .filter((piece) => piece[0] === "s")
    .map((piece) => piece[1]);
  assert(
    JSON.stringify(sections) === JSON.stringify(MASTER_ROLE_SECTIONS),
    "role-section order mismatch",
  );

  const referencedUnits = new Set(
    masterTemplate.pieces
      .filter((piece) => piece[0] === "u")
      .map((piece) => piece[1]),
  );
  assert(
    referencedUnits.size === provenance.unitCount,
    "referenced unit count mismatch",
  );
  for (const [locale, units] of Object.entries(unitsByLocale)) {
    for (const unitId of referencedUnits) {
      assert(units[unitId] !== undefined, `${locale} is missing ${unitId}`);
    }
  }
}

validateAssets();

export const MASTER_PROMPT_PROVENANCE = Object.freeze({
  templateId: provenance.templateId,
  sourceTemplateId: provenance.sourceTemplateId,
  canonicalPolicyVersion: provenance.canonicalPolicyVersion,
  englishPolicyVersion: provenance.englishPolicyVersion,
  templateSha256: provenance.templateSha256,
  bundleSha256: provenance.bundleSha256,
  renderedSourceSha256: provenance.renderedSourceSha256,
  renderedEnglishSha256: provenance.renderedEnglishSha256,
  verifiedCharacterCount: provenance.promptCount,
});

export const DEARM_PROMPT_ADAPTER_VERSION = "dearm-single-master-v1";

export interface RenderMasterPromptInput {
  characterName: string;
  instructionLocale: MasterInstructionLocale;
  sections: Record<MasterRoleSection, string>;
}

/**
 * Reconstruct the canonical structured template. Literal and translated unit
 * pieces are immutable; only the two declared character-name tokens and six
 * declared role sections are substituted. Section content is inserted byte
 * for byte so creator HTML/CSS/JS/XML and template variables are not trimmed or
 * normalized by the host adapter.
 */
export function renderMasterPrompt({
  characterName,
  instructionLocale,
  sections,
}: RenderMasterPromptInput): string {
  const units = unitsByLocale[instructionLocale];

  return masterTemplate.pieces
    .map((piece) => {
      if (piece[0] === "s") {
        const sectionName = piece[1] as MasterRoleSection;
        assert(sectionName in sections, `missing role section ${sectionName}`);
        return sections[sectionName];
      }

      const value = piece[0] === "l" ? piece[1] : units[piece[1]];
      assert(
        value !== undefined,
        `missing ${instructionLocale} unit ${piece[1]}`,
      );
      return value.replaceAll(CHARACTER_NAME_TOKEN, characterName);
    })
    .join("");
}
