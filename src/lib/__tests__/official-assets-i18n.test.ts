import { describe, expect, test } from "bun:test";
import { en } from "@/i18n/en";
import { jaJP } from "@/i18n/ja-JP";
import { thTH } from "@/i18n/th-TH";
import type { Dict } from "@/i18n/types";
import { zh } from "@/i18n/zh";
import { zhTW } from "@/i18n/zh-TW";
import type { BeautificationPack, RegexRule } from "@/lib/db/schema";
import {
  localizeOfficialPack,
  OFFICIAL_PACK_CANONICAL_DESCRIPTION,
  OFFICIAL_PACK_CANONICAL_NAME,
} from "@/lib/packs/official-copy";
import {
  OFFICIAL_PACK_ID,
  OFFICIAL_RULE_ENV_PANEL_ID,
  OFFICIAL_RULE_MEMORY_ID,
  OFFICIAL_RULE_YEARN_PHONE_ID,
  OFFICIAL_SYSTEM_USER_ID,
} from "@/lib/packs/official-ids";
import { localizeOfficialRules } from "@/lib/packs/official-rule-copy";
import { buildIframeSrcdoc } from "@/lib/regex/iframe-bridge";
import { getRegexTemplates } from "@/lib/regex/templates";
import {
  buildYearnPhoneArtifact,
  YEARN_PHONE_SAMPLE_TEXT,
  YEARN_PHONE_UI_BY_LOCALE,
} from "@/lib/regex/yearn-phone";

const dictionaries: Dict[] = [zh, zhTW, jaJP, thTH, en];

describe("localized official regex templates", () => {
  test("locale changes copy/examples but not canonical protocol", () => {
    const localized = dictionaries.map(getRegexTemplates);
    const canonical = localized[4];

    for (const templates of localized) {
      expect(templates.map(({ id }) => id)).toEqual([
        "env_state_panel",
        "dynamic_memory",
        "emphasis_text",
        "yearn_phone_placeholder",
      ]);
      expect(templates.map(({ preset }) => preset.pattern)).toEqual(
        canonical.map(({ preset }) => preset.pattern),
      );
      expect(templates[0]?.preset.replacement).toContain("nj_env_panel");
      expect(templates[0]?.preset.replacement).toContain("$1");
      expect(templates[0]?.preset.replacement).toContain("$2");
      expect(templates[0]?.preset.replacement).toContain("$3");
      expect(templates[1]?.preset.replacement).toContain("nj_memory");
      expect(templates[1]?.preset.replacement).toContain("$1");
      expect(templates[1]?.preset.replacement).toContain("$2");
      expect(templates[2]?.preset.replacement).toContain("nj_emphasis_text");
      expect(templates[2]?.preset.replacement).toContain("$1");
      expect(templates[3]?.preset.replacement).toMatch(
        /^<artifact>[\s\S]*<\/artifact>$/,
      );
    }
  });

  test("phone preset uses the active dictionary's protocol-safe sample", () => {
    for (const dictionary of dictionaries) {
      const phone = getRegexTemplates(dictionary).find(
        ({ id }) => id === "yearn_phone_placeholder",
      );
      expect(phone?.preset.targetText).toBe(
        dictionary.characterForm.sandboxPhoneSampleText,
      );
      expect(phone?.preset.targetText).toContain("[wechat]");
      expect(phone?.preset.targetText).toContain("user: ");
      expect(phone?.preset.targetText).toContain("|||");
      expect(phone?.preset.outputGuidance).toContain("<phone>...</phone>");
    }
  });

  test("Japanese and Thai presets do not fall back to Simplified Chinese", () => {
    const simplifiedFragments = [
      "环境状态面板",
      "动态记忆区",
      "多云转小雨",
      "天气：",
      "记忆区",
      "强调内容",
      "还没收到消息",
      "输入内容",
      "这个应用",
    ];
    const japaneseCopy = JSON.stringify(
      getRegexTemplates(jaJP).map(({ id, label, hint, preset }) => ({
        id,
        label,
        hint,
        name: preset.name,
        targetText: preset.targetText,
        variableMapping: preset.variableMapping,
        outputGuidance: preset.outputGuidance,
      })),
    );
    for (const fragment of simplifiedFragments) {
      expect(japaneseCopy).not.toContain(fragment);
    }

    const thaiCopy = JSON.stringify(
      getRegexTemplates(thTH).map(({ id, label, hint, preset }) => ({
        id,
        label,
        hint,
        name: preset.name,
        targetText: preset.targetText,
        variableMapping: preset.variableMapping,
        outputGuidance: preset.outputGuidance,
        replacement:
          id === "yearn_phone_placeholder" ? undefined : preset.replacement,
      })),
    );
    expect(thaiCopy).not.toMatch(/\p{Script=Han}/u);
  });
});

describe("official pack canonical storage and locale projection", () => {
  const canonicalPack: BeautificationPack = {
    id: OFFICIAL_PACK_ID,
    ownerUserId: OFFICIAL_SYSTEM_USER_ID,
    name: OFFICIAL_PACK_CANONICAL_NAME,
    description: OFFICIAL_PACK_CANONICAL_DESCRIPTION,
    globalCss: ".nj_phone_shell{}",
    isPublic: true,
    subscriberCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  test("canonical DB copy is locale-neutral and remains unchanged", () => {
    expect(OFFICIAL_PACK_CANONICAL_NAME).not.toMatch(/\p{Script=Han}/u);
    expect(OFFICIAL_PACK_CANONICAL_DESCRIPTION).not.toMatch(/\p{Script=Han}/u);
    expect(localizeOfficialPack(canonicalPack)).toBe(canonicalPack);
  });

  test("projection is request-local and does not mutate the shared row", () => {
    for (const dictionary of dictionaries) {
      const localized = localizeOfficialPack(canonicalPack, dictionary.packs);
      expect(localized.name).toBe(dictionary.packs.officialPackName);
      expect(localized.description).toBe(
        dictionary.packs.officialPackDescription,
      );
    }
    expect(canonicalPack.name).toBe(OFFICIAL_PACK_CANONICAL_NAME);
    expect(canonicalPack.description).toBe(OFFICIAL_PACK_CANONICAL_DESCRIPTION);
  });
});

describe("official rule request projection", () => {
  const templateIds = [
    "yearn_phone_placeholder",
    "env_state_panel",
    "dynamic_memory",
  ];
  const ruleIds = [
    OFFICIAL_RULE_YEARN_PHONE_ID,
    OFFICIAL_RULE_ENV_PANEL_ID,
    OFFICIAL_RULE_MEMORY_ID,
  ];
  const canonicalRules: RegexRule[] = templateIds.map((templateId, index) => {
    const preset = getRegexTemplates(en).find(
      ({ id }) => id === templateId,
    )?.preset;
    if (!preset) throw new Error(`missing test template ${templateId}`);
    return {
      id: ruleIds[index] as string,
      packId: OFFICIAL_PACK_ID,
      ...preset,
      enabled: true,
      orderIndex: index,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  });

  test("localizes visible replacement and prompt guidance without changing protocol", () => {
    const thai = localizeOfficialRules(canonicalRules, thTH);
    const japanese = localizeOfficialRules(canonicalRules, jaJP);

    expect(thai.map(({ pattern }) => pattern)).toEqual(
      canonicalRules.map(({ pattern }) => pattern),
    );
    expect(thai.map(({ id }) => id)).toEqual(ruleIds);
    expect(thai[1]?.replacement).toContain("สภาพอากาศ");
    expect(thai[1]?.replacement).toContain("$1");
    expect(thai[1]?.replacement).toContain("$2");
    expect(thai[2]?.replacement).toContain("ความจำ");
    expect(thai[2]?.replacement).toContain("$1");
    expect(thai[2]?.replacement).toContain("$2");
    expect(thai[1]?.replacement).not.toMatch(/\p{Script=Han}/u);
    expect(thai[2]?.replacement).not.toMatch(/\p{Script=Han}/u);
    expect(japanese[1]?.replacement).toContain("天気");
    expect(japanese[2]?.replacement).toContain("メモリー");
    expect(japanese[0]?.replacement).toBe(canonicalRules[0]?.replacement);
  });
});

describe("Dearm Phone locale context", () => {
  test("bridge exposes locale and artifact resolves it after host-ready", () => {
    const bridge = buildIframeSrcdoc({
      srcdoc: "<div>test</div>",
      captureGroups: [],
    });
    const artifact = buildYearnPhoneArtifact();
    expect(bridge).toContain("locale: 'en'");
    expect(artifact).toContain("window.host.context.locale");
    expect(artifact).toContain('return "ja-JP"');
    expect(artifact).toContain('return "th-TH"');
    expect(artifact).toContain("host-ready");
  });

  test("all four locale maps preserve selectors and protocol", () => {
    expect(Object.keys(YEARN_PHONE_UI_BY_LOCALE).sort()).toEqual([
      "en",
      "ja-JP",
      "th-TH",
      "zh-TW",
    ]);
    expect(JSON.stringify(YEARN_PHONE_UI_BY_LOCALE["th-TH"])).not.toMatch(
      /\p{Script=Han}/u,
    );
    expect(YEARN_PHONE_UI_BY_LOCALE["ja-JP"].send).toBe("送信");
    expect(YEARN_PHONE_UI_BY_LOCALE["th-TH"].send).toBe("ส่ง");
    expect(YEARN_PHONE_UI_BY_LOCALE.en.send).toBe("Send");
    expect(YEARN_PHONE_SAMPLE_TEXT).toContain("<phone>");
    expect(YEARN_PHONE_SAMPLE_TEXT).toContain("[wallet]");
    expect(YEARN_PHONE_SAMPLE_TEXT).not.toMatch(/\p{Script=Han}/u);

    const artifact = buildYearnPhoneArtifact();
    for (const selector of [
      "nj_phone_shell",
      "nj_phone_frame",
      "nj_phone_app",
      "nj_phone_home_indicator",
    ]) {
      expect(artifact).toContain(selector);
    }
  });
});
