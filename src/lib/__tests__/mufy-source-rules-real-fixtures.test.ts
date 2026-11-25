import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyMufySourceRules,
  type MufySourceRuleCapture,
  prepareMufySourceRules,
} from "../import/mufy-source-rules";

// Local experiment assets are intentionally not committed. Missing evidence is
// an explicit skip, never a synthetic pass or a reason to fetch source prompts.
const root = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const inputsPath = resolve(root, "reply-fixtures/new-values-20261015.json");
const cards = [
  [
    "风满楼",
    "char_6e3124e6065bbcd98988",
    "66e284e0-bcc5-4104-88cd-909d5b52305d",
  ],
  [
    "薛山烬",
    "char_d8872979bd9e37140fc0",
    "396e1ded-9bfc-42e4-9350-c04a33e52a0f",
  ],
  [
    "祁远宁",
    "char_1b2bb5f25322320f9909",
    "54aa723f-f61a-40ff-89cb-2c003388675d",
  ],
  [
    "周岳山",
    "char_16b7d17605d4f118e6f8",
    "d37e7f92-5cd7-41bf-8510-e70621f734d0",
  ],
  [
    "宋怀远",
    "char_d85ff081aef1264cc2d0",
    "2bcfd009-553c-4434-a599-942c89a28da9",
  ],
] as const;
type Fixture = {
  name: string;
  roleId: string;
  raw: string;
  removedTags?: string[];
  retainedValues?: string[];
  retainedTags?: string[];
};
type FixtureResult = {
  name: string;
  roleId: string;
  matchedRules: Array<{ id: string; name: string; count: number }>;
  remainingInputTags: string[];
  expectedTagsRemaining: string[];
  missingValues: string[];
  inputLength: number;
  outputLength: number;
  status: string;
};
const captures = new Map<string, MufySourceRuleCapture>();
for (const [, key, id] of cards) {
  const path = resolve(root, key, "mufy-source-rules-original-20261015.json");
  if (existsSync(path))
    captures.set(
      id,
      JSON.parse(readFileSync(path, "utf8")) as MufySourceRuleCapture,
    );
}
const localFixtures = existsSync(inputsPath)
  ? (JSON.parse(readFileSync(inputsPath, "utf8")) as { cases: Fixture[] })
  : undefined;
const xsj = cards[1][2];
const tag = (name: string, ...values: string[]) =>
  `<${name}>◇${values.join("◇")}◇</${name}>`;
const url = "https://example.test/new-fixture.png";
const supplemental: Fixture[] = [
  {
    name: "XSJ-source-text-replacement",
    roleId: xsj,
    raw: "老子是合成的新值规则探针2099",
    removedTags: [],
    retainedValues: ["合成的新值规则探针2099"],
  },
  {
    name: "XSJ-phone-valid-chat-and-imsg",
    roleId: xsj,
    raw:
      tag("chatL", url, "NEW-LEFT-2099") +
      "<chatR>NEW-RIGHT-2099</chatR><imsg><iname>NEW-CONTACT-2099</iname><itime>23:59</itime>" +
      tag("itxtL", "23:58", "NEW-SMS-LEFT") +
      tag("itxtR", "23:59", "NEW-SMS-RIGHT") +
      "</imsg>",
    removedTags: ["chatL", "chatR", "imsg", "iname", "itime", "itxtL", "itxtR"],
    retainedValues: [
      "NEW-LEFT-2099",
      "NEW-RIGHT-2099",
      "NEW-CONTACT-2099",
      "NEW-SMS-LEFT",
      "NEW-SMS-RIGHT",
    ],
  },
  {
    name: "XSJ-phone-media-and-transfer-protocols",
    roleId: xsj,
    raw:
      "<imsg>" +
      [
        "iyesL",
        "iyesR",
        "itraL",
        "itraR",
        "inoL",
        "inoR",
        "iimgL",
        "iimgR",
        "istiL",
        "istiR",
      ]
        .map((name) => tag(name, url, `NEW-${name}`))
        .join("") +
      ["iaudL", "iaudR", "ilocL", "ilocR", "ilinkL", "ilinkR"]
        .map((name) => tag(name, url, "NEW-TITLE", `NEW-${name}`))
        .join("") +
      "</imsg>",
    removedTags: [
      "imsg",
      "iyesL",
      "iyesR",
      "itraL",
      "itraR",
      "inoL",
      "inoR",
      "iimgL",
      "iimgR",
      "istiL",
      "istiR",
      "iaudL",
      "iaudR",
      "ilocL",
      "ilocR",
      "ilinkL",
      "ilinkR",
    ],
  },
  {
    name: "XSJ-twitter-feed-and-DM",
    roleId: xsj,
    raw:
      "<tw><up>NEW-UP</up><首页><post><no>2</no><ava>" +
      url +
      "</ava><name>NEW-NAME</name><id>NEW-ID</id><txt>NEW-POST</txt><img>" +
      url +
      "</img><con>NEW-CON</con></post></首页><趋势><trend><fl>NEW-FL</fl><tag>NEW-TREND</tag><num>2099</num></trend></趋势><私信><dm><no>3</no><ava>" +
      url +
      "</ava><name>NEW-DM-NAME</name><id>NEW-DM-ID</id><time>23:59</time><txt>NEW-DM-TEXT</txt></dm></私信><推送><notify><ava>" +
      url +
      "</ava><txt>NEW-NOTIFY</txt></notify></推送></tw>",
    removedTags: [
      "tw",
      "up",
      "首页",
      "post",
      "趋势",
      "trend",
      "私信",
      "dm",
      "推送",
      "notify",
    ],
    retainedValues: ["NEW-POST", "NEW-TREND", "NEW-DM-TEXT", "NEW-NOTIFY"],
  },
  {
    name: "XSJ-social-post-details",
    roleId: xsj,
    raw:
      "<fm>" +
      tag(
        "fmbody",
        url,
        "NEW-AUTHOR",
        "NEW-TIME",
        "NEW-POST-BODY",
        "NEW-META",
      ) +
      tag("numbox", "11", "12", "13", "14") +
      tag("fmcon", url, "NEW-COMMENTER", "NEW-COMMENT", "NEW-COMMENT-TIME") +
      "<mediaurl>" +
      url +
      "</mediaurl><mediatxt>NEW-MEDIA-DESCRIPTION</mediatxt></fm>",
    removedTags: ["fm", "fmbody", "numbox", "fmcon", "mediaurl", "mediatxt"],
    retainedValues: ["NEW-POST-BODY", "NEW-COMMENT", "NEW-MEDIA-DESCRIPTION"],
  },
  {
    name: "XSJ-additional-fold-and-dialogue",
    roleId: xsj,
    raw:
      "<chatRsti>" +
      url +
      "</chatRsti>" +
      tag("chatLsti", url, url) +
      ["cap", "fina", "brow"]
        .map((name) => tag(name, "NEW-A", "NEW-B", "NEW-C", "NEW-D"))
        .join("") +
      "<xsj>NEW-CHAR-DIALOGUE</xsj><else>NEW-OTHER-DIALOGUE</else>",
    removedTags: ["chatRsti", "chatLsti", "cap", "fina", "brow", "xsj", "else"],
    retainedValues: ["NEW-CHAR-DIALOGUE", "NEW-OTHER-DIALOGUE"],
  },
  {
    name: "XSJ-twitter-profile-and-private-thread",
    roleId: xsj,
    raw:
      "<hpg>" +
      tag(
        "info",
        url,
        "NEW-HANDLE",
        "NEW-NAME",
        "NEW-BIO",
        "NEW-LOCATION",
        "NEW-DATE",
        "21",
        "22",
        "23",
      ) +
      "<大号>" +
      tag("reninfo", url, "NEW-A", "NEW-B", "NEW-C", "NEW-D") +
      tag("hpgtxt", "NEW-TIME", "NEW-TEXT", "NEW-COUNT") +
      "<hpgcon>NEW-REPLY</hpgcon>" +
      tag("hpgimg", "NEW-TIME", "NEW-IMG", url, "NEW-COUNT") +
      tag(
        "hpglink",
        "NEW-TIME",
        "NEW-LINK",
        "https://example.test/",
        "NEW-COUNT",
      ) +
      tag(
        "hpgmsc",
        "NEW-TIME",
        "NEW-MUSIC",
        "NEW-ARTIST",
        "https://example.test/a.mp3",
        "NEW-COUNT",
      ) +
      "</大号><小号>" +
      tag("altinfo", "NEW-A", "NEW-B", "NEW-C", "NEW-D") +
      "</小号><usr>" +
      tag("usrinfo", url, "NEW-A", "NEW-B", "NEW-C", "NEW-D") +
      "</usr></hpg><dmal>" +
      tag("dminfo", url, "NEW-CONTACT", "NEW-ID") +
      "<mebub>NEW-OWN-DM<mebub>" +
      tag("othbub", url, "NEW-OTHER-DM") +
      "</dmal>",
    removedTags: [
      "hpg",
      "info",
      "大号",
      "reninfo",
      "hpgtxt",
      "hpgcon",
      "hpgimg",
      "hpglink",
      "hpgmsc",
      "小号",
      "altinfo",
      "usr",
      "usrinfo",
      "dmal",
      "dminfo",
      "mebub",
      "othbub",
    ],
    retainedValues: ["NEW-OWN-DM", "NEW-OTHER-DM", "NEW-TEXT"],
  },
  {
    name: "XSJ-source-directive-and-truncation-components",
    roleId: xsj,
    raw: "<定制指令组件正则>本轮未截断",
    removedTags: ["定制指令组件正则"],
  },
  {
    name: "Song-source-player-token",
    roleId: cards[4][2],
    raw: "<云朵播放器>",
    removedTags: ["云朵播放器"],
  },
];
const results: FixtureResult[] = [];
const bridgePatterns: Record<string, RegExp> = {
  windowParent: /\bwindow\s*\.\s*parent\b/g,
  parentDocument: /\bparent\s*\.\s*document\b/g,
  topReference: /\b(?:window\s*\.\s*)?top\s*(?:\.|\[)/g,
  localStorage: /\blocalStorage\b/g,
  execCommand: /\bexecCommand\b/g,
  frameElement: /\bframeElement\b/g,
  clipboard: /\bclipboard\b/g,
  postMessage: /\bpostMessage\b/g,
};
const bridgeInventory = cards.map(([name, , roleId]) => {
  const source = captures.get(roleId);
  return {
    name,
    roleId,
    sourceRuleCount: source?.rules.length ?? null,
    sourceSha256: source
      ? createHash("sha256").update(JSON.stringify(source)).digest("hex")
      : null,
    patterns: Object.fromEntries(
      Object.entries(bridgePatterns).map(([key, pattern]) => {
        const hits = (source?.rules ?? [])
          .map((rule) => ({
            ruleId: String(rule.regexRuleId),
            name: rule.ruleName,
            occurrences: [...rule.replaceString.matchAll(pattern)].length,
          }))
          .filter((item) => item.occurrences > 0);
        return [
          key,
          {
            occurrences: hits.reduce((sum, item) => sum + item.occurrences, 0),
            rules: hits,
          },
        ];
      }),
    ),
  };
});
const fixtures = [
  ...(localFixtures?.cases ?? []).map((fixture) => {
    if (fixture.name === "风满楼")
      return {
        ...fixture,
        removedTags: ["TimeBox", "Year", "Date", "Time", "Loc"],
      };
    if (fixture.name === "薛山烬")
      return {
        ...fixture,
        removedTags: [
          "meta",
          "基础状态",
          "loveornot",
          "eval",
          "split",
          "核心记忆",
          "记忆卷",
        ],
      };
    if (fixture.name === "薛山烬-未恢复协议必须失败")
      return { ...fixture, retainedTags: ["itxtL", "fmbody"] };
    return fixture;
  }),
  ...supplemental,
];
describe("real captured public rules / synthetic future reply coverage", () => {
  test.skipIf(!localFixtures)(
    "local new-value fixtures exist (otherwise evidence unavailable)",
    () => expect(localFixtures).toBeDefined(),
  );
  for (const fixture of fixtures) {
    test.skipIf(!captures.has(fixture.roleId))(fixture.name, () => {
      const capture = captures.get(fixture.roleId);
      if (!capture) throw new Error("missing source evidence");
      const rendered = applyMufySourceRules(
        fixture.raw,
        prepareMufySourceRules(capture, fixture.roleId),
      );
      const markup = rendered.html
        .replace(/<script\b[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[\s\S]*?<\/style>/gi, "");
      const inputTags = [
        ...new Set(
          [
            ...fixture.raw.matchAll(
              /<([\p{L}][\p{L}\p{N}_-]*)(?=[\s/>])[^>]*>/gu,
            ),
          ].map((m) => m[1]),
        ),
      ];
      const hasTag = (name: string) =>
        new RegExp(`<${name}(?:\\s|>)`, "u").test(markup);
      const expectedTagsRemaining = (fixture.removedTags ?? []).filter(hasTag);
      const missingValues = (fixture.retainedValues ?? []).filter(
        (value) => !rendered.html.includes(value),
      );
      results.push({
        name: fixture.name,
        roleId: fixture.roleId,
        inputLength: fixture.raw.length,
        outputLength: rendered.html.length,
        matchedRules: rendered.matchedRules,
        remainingInputTags: inputTags.filter(hasTag),
        expectedTagsRemaining,
        missingValues,
        status:
          expectedTagsRemaining.length || missingValues.length
            ? "failed"
            : fixture.removedTags
              ? "protocol-transform-passed"
              : "measured-existing-fixture-only",
      });
      expect(expectedTagsRemaining).toEqual([]);
      expect(missingValues).toEqual([]);
      for (const name of fixture.retainedTags ?? [])
        expect(hasTag(name)).toBe(true);
    });
  }
});
afterAll(async () => {
  if (!existsSync(root)) return;
  await Bun.write(
    resolve(root, "reply-fixtures/source-rules-browser-inputs-20261015.json"),
    `${JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      scope: "Synthetic new-value browser inputs only; no source opening or persona text. Example media URLs intentionally do not load.",
      cases: fixtures,
    }, null, 2)}\n`,
  );
  await Bun.write(
    resolve(root, "reply-fixtures/source-rules-coverage-20261015.json"),
    `${JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        scope:
          "Synthetic rule-transform tests only, not browser fidelity or media playback acceptance",
        source: "normal-page-public-render-rules",
        limitations: [
          "Source rules alone do not replace mufyer/user variables; host text-node adaptation remains required",
          "Zero-rule cards rely on their raw HTML and sandbox adaptation, not source regex transformations",
          "Example media URLs intentionally do not load",
          "Old malformed phone fixture is measured, not relabeled as a valid protocol",
          "No screenshots or actual platform chat acceptance in this report",
        ],
        bridgeInventory,
        coverage: cards.map(([name, , roleId]) => {
          const source = captures.get(roleId);
          const matched = new Set(
            results
              .filter((r) => r.roleId === roleId)
              .flatMap((r) => r.matchedRules.map((rule) => rule.id)),
          );
          return {
            name,
            roleId,
            sourceRuleCount: source?.rules.length ?? null,
            matchedUniqueRuleCount: matched.size,
            uncoveredRules:
              source?.rules
                .filter((rule) => !matched.has(String(rule.regexRuleId)))
                .map((rule) => ({
                  id: String(rule.regexRuleId),
                  name: rule.ruleName,
                })) ?? null,
          };
        }),
        results,
      },
      null,
      2,
    )}\n`,
  );
});
