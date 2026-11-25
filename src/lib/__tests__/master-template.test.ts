import { describe, expect, test } from "bun:test";
import {
  DEARM_PROMPT_ADAPTER_VERSION,
  MASTER_PROMPT_PROVENANCE,
  MASTER_ROLE_SECTIONS,
  type MasterRoleSection,
  renderMasterPrompt,
} from "@/lib/ai/master-template";

function sectionFixtures(): Record<MasterRoleSection, string> {
  return Object.fromEntries(
    MASTER_ROLE_SECTIONS.map((section) => [
      section,
      `<${section} data-code="{{state.value}}">\n/* nj_card */\nconst x = "$1";\n</${section}>`,
    ]),
  ) as Record<MasterRoleSection, string>;
}

describe("canonical master asset", () => {
  test("pins audited provenance and reconstruction count", () => {
    expect(DEARM_PROMPT_ADAPTER_VERSION).toBe("dearm-single-master-v1");
    expect(MASTER_PROMPT_PROVENANCE.templateId).toBe(
      "t_74f21ea242914b7a8ddbd4b12e808ee9d74a4277e73ebeffb9104b0eddef77f4",
    );
    expect(MASTER_PROMPT_PROVENANCE.templateSha256).toBe(
      "a507d70c79646760bf01956c2ecd78d8eea461f46665526d31ddf6311c3652a8",
    );
    expect(MASTER_PROMPT_PROVENANCE.bundleSha256).toBe(
      "8881820e80f001483acda016dc44626199b6e9154b13a37e06b4254c1c00d7c5",
    );
    expect(MASTER_PROMPT_PROVENANCE.verifiedCharacterCount).toBe(10_839);
  });

  test("inserts all six role sections exactly once and in order", () => {
    const prompt = renderMasterPrompt({
      characterName: "角色名",
      instructionLocale: "zh-Hans",
      sections: sectionFixtures(),
    });
    let previous = -1;
    for (const section of MASTER_ROLE_SECTIONS) {
      const marker = `<${section} data-code=`;
      expect(prompt.split(marker)).toHaveLength(2);
      const index = prompt.indexOf(marker);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });

  test("preserves creator HTML, CSS, JS, variables, and replacement tokens", () => {
    const sections = sectionFixtures();
    const prompt = renderMasterPrompt({
      characterName: "角色名",
      instructionLocale: "en",
      sections,
    });
    for (const section of MASTER_ROLE_SECTIONS) {
      expect(prompt).toContain(sections[section]);
    }
    expect(prompt).toContain('{{state.value}}">\n/* nj_card */');
    expect(prompt).toContain('const x = "$1";');
    expect(prompt).not.toContain("⟦CHARACTER_NAME⟧");
  });

  test("renders deterministically", () => {
    const input = {
      characterName: "角色名",
      instructionLocale: "en" as const,
      sections: sectionFixtures(),
    };
    expect(renderMasterPrompt(input)).toBe(renderMasterPrompt(input));
  });
});
