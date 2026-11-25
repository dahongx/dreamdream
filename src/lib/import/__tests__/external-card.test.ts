import { describe, expect, test } from "bun:test";
import {
  convertLegacyCss,
  mapExternalCardRule,
  parseExternalCharacterXml,
  parseExternalRulesJson,
} from "@/lib/import/external-card";
import {
  LEGACY_SELECTOR_PREFIX as P,
  EXTERNAL_CARD_ROOT_TAG as ROOT,
} from "@/lib/import/legacy-format";
import { buildRegExp } from "@/lib/regex/apply";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";

// 来自真实导出 regex-rules-*.json 的一条规则。pattern 写成 TS 字面量后等于
// 来源平台 JSON.parse 出来的样子（`/\<status\>.../g`）。
const SAMPLE_RULE = {
  id: "1781666746390",
  ruleName: "测试状态栏",
  regexPattern:
    "/\\<status\\>\\<hp\\>([\\s\\S]*?)\\<\\/hp\\>\\<mood\\>([\\s\\S]*?)\\<\\/mood\\>\\<\\/status\\>/g",
  replaceString:
    '<div style="padding:8px;border:1px solid gold;border-radius:6px;color:gold">❤️ 生命:$1 ｜ 心情:$2</div>',
  enabled: true,
  visibility: false,
  mode: 1,
  targetSymbol: "<status><hp>80</hp><mood>开心</mood></status>",
};
const RULES_JSON = JSON.stringify([SAMPLE_RULE]);

test("plaintext theater survives normal XML import without entering persona", () => {
  const html='<floating kind="details-right"><details><summary>手机</summary>内容</details></floating>';
  const result=parseExternalCharacterXml(`<${ROOT}><元信息><名称>fixture</名称></元信息><人设>人设</人设><小剧场><![CDATA[${html}]]></小剧场></${ROOT}>`);
  expect(result.ok).toBe(true);
  if(!result.ok)return;
  expect(result.value.openingComponent).toBe(html);
  expect(result.value.character.persona).toBe('人设');
  expect(result.value.lockedFields).toEqual([]);
});

// 真实角色卡导出的结构子集；<正则规则> 内嵌同款 JSON（用上面的 RULES_JSON）。
const CHARACTER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<${ROOT} version="1" type="single">
  <元信息>
    <名称><![CDATA[da]]></名称>
    <性别>0</性别>
    <性别文本><![CDATA[女性]]></性别文本>
    <年龄>20</年龄>
    <NSFW>false</NSFW>
    <AI>false</AI>
    <内容类型>original</内容类型>
    <封面图><![CDATA[https://cdn.example.com/images/27e7a7a1/public]]></封面图>
    <头像><![CDATA[https://cdn.example.com/images/af5898c8/public]]></头像>
  </元信息>
  <标签><tag><![CDATA[纯爱]]></tag></标签>
  <世界观标签><tag><![CDATA[校园]]></tag></世界观标签>
  <模式标签><tag><![CDATA[单人]]></tag></模式标签>
  <角色介绍><![CDATA[沈氏掌权人]]></角色介绍>
  <人设><![CDATA[外貌与气质：浅银灰卷发]]></人设>
  <逆境处理><![CDATA[出身：京城老牌世家]]></逆境处理>
  <可见性>1</可见性>
  <正则规则><![CDATA[${RULES_JSON}]]></正则规则>
</${ROOT}>`;

describe("parseExternalRulesJson — 正则导入", () => {
  test("解析真实样本：字段映射正确", () => {
    const r = parseExternalRulesJson(RULES_JSON);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(1);
    const rule = r.value[0];
    expect(rule.name).toBe("测试状态栏");
    expect(rule.targetText).toBe(
      "<status><hp>80</hp><mood>开心</mood></status>",
    );
    expect(rule.enabled).toBe(true);
    expect(rule.visible).toBe(false);
    expect(rule.orderIndex).toBe(0);
    // 导入规则一律 render-only：不再自动生成 outputGuidance（触发指令交给卡面）
    expect(rule.outputGuidance).toBeNull();
    expect(rule.variableMapping).toEqual([]);
    // pattern 原样透传 literal 形式
    expect(rule.pattern.startsWith("/")).toBe(true);
    expect(rule.pattern.endsWith("/g")).toBe(true);
  });

  test("导入的 pattern 能被 buildRegExp 编译并匹配 targetText（端到端语义）", () => {
    const r = parseExternalRulesJson(RULES_JSON);
    if (!r.ok) throw new Error("parse failed");
    const rule = r.value[0];
    const re = buildRegExp(rule.pattern);
    const out = (rule.targetText as string).replace(re, rule.replacement);
    expect(out).toContain("生命:80");
    expect(out).toContain("心情:开心");
    expect(out).not.toContain("$1");
  });

  test("坏 JSON → 友好报错，不抛异常", () => {
    const r = parseExternalRulesJson("{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });

  test("不是数组 → 报错", () => {
    const r = parseExternalRulesJson('{"ruleName":"x"}');
    expect(r.ok).toBe(false);
  });

  test("全是无效规则（缺 pattern）→ 报错", () => {
    const r = parseExternalRulesJson(
      JSON.stringify([{ ruleName: "空", replaceString: "<div></div>" }]),
    );
    expect(r.ok).toBe(false);
  });

  test("enabled 缺省→true，visibility 缺省→false", () => {
    const r = parseExternalRulesJson(
      JSON.stringify([{ regexPattern: "/a/g", replaceString: "b" }]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0].enabled).toBe(true);
    expect(r.value[0].visible).toBe(false);
    expect(r.value[0].name).toBe("未命名规则");
  });
});

describe("mapExternalCardRule — 单条映射", () => {
  test("缺 pattern 或 replacement → null", () => {
    expect(mapExternalCardRule({ ruleName: "x" }, 0)).toBeNull();
    expect(mapExternalCardRule({ regexPattern: "/a/" }, 0)).toBeNull();
    expect(mapExternalCardRule({ replaceString: "b" }, 0)).toBeNull();
  });
  test("orderIndex 透传", () => {
    const m = mapExternalCardRule(
      { regexPattern: "/a/", replaceString: "b" },
      5,
    );
    expect(m?.orderIndex).toBe(5);
  });

  test("```html 围栏 replacement → 归一成 <artifact> 外壳（能路由进 iframe）", () => {
    const m = mapExternalCardRule(
      {
        ruleName: "小手机",
        regexPattern: "/<PhoneChat>([\\s\\S]*?)<\\/PhoneChat>/g",
        replaceString:
          "```html\n<div><style>.x{color:red}</style><script>void 0</script>$1</div>\n```",
      },
      0,
    );
    expect(m).not.toBeNull();
    expect(m?.replacement).toBe(
      "<artifact><div><style>.x{color:red}</style><script>void 0</script>$1</div></artifact>",
    );
    // 捕获组占位符必须保留，供 segments.ts 后续替换
    expect(m?.replacement).toContain("$1");
  });

  test("非围栏 replacement 原样透传（不误包 artifact）", () => {
    const m = mapExternalCardRule(
      { regexPattern: "/<x>(.*?)<\\/x>/g", replaceString: "<div>$1</div>" },
      0,
    );
    expect(m?.replacement).toBe("<div>$1</div>");
  });
});

describe("parseExternalCharacterXml — 角色卡导入", () => {
  test("解析真实样本：元信息 + 正文 + 内嵌正则", () => {
    const r = parseExternalCharacterXml(CHARACTER_XML);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { character, rules } = r.value;

    expect(character.name).toBe("da");
    expect(character.gender).toBe("female");
    expect(character.age).toBe(20);
    expect(character.nsfw).toBe(false);
    expect(character.isAi).toBe(false);
    expect(character.contentType).toBe("original");
    expect(character.coverImageUrl).toBe(
      "https://cdn.example.com/images/27e7a7a1/public",
    );
    expect(character.avatarUrl).toBe(
      "https://cdn.example.com/images/af5898c8/public",
    );
    expect(character.tags).toEqual(["纯爱", "校园", "单人"]);
    expect(character.bio).toBe("沈氏掌权人");
    expect(character.persona).toContain("外貌");
    expect(character.adversity).toContain("京城");

    // 内嵌正则被提取
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe("测试状态栏");
  });

  test("非本格式 XML → 报错", () => {
    const r = parseExternalCharacterXml("<foo><bar>1</bar></foo>");
    expect(r.ok).toBe(false);
  });

  test("坏 XML → 报错不抛异常", () => {
    const r = parseExternalCharacterXml("<<<not xml");
    expect(r.ok).toBe(false);
  });

  test("缺名称 → 报错", () => {
    const r = parseExternalCharacterXml(
      `<${ROOT}><元信息><年龄>20</年龄></元信息></${ROOT}>`,
    );
    expect(r.ok).toBe(false);
  });

  test("无内嵌正则的角色卡照样导入，rules 为空", () => {
    const r = parseExternalCharacterXml(
      `<${ROOT}><元信息><名称><![CDATA[空熊]]></名称></元信息></${ROOT}>`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.character.name).toBe("空熊");
    expect(r.value.rules).toEqual([]);
  });
});

describe("parseExternalCharacterXml — 满填样本：新字段映射 + 加密检测", () => {
  // 真实导出里来源平台把「小剧场」「全局美化(样式代码)」AES 加密成
  // base64({salt,iv,ciphertext})。以下两串取自真实满填样本。
  const ENC_XIAOJUCHANG =
    "eyJzYWx0IjoiNjRmZDBmYTQzZjEyZDQzMzUwOTY3ZDY0NWFhYzQ2MjYiLCJpdiI6IjlmYjU0YmQwODExMjQxMjZhZjM0NGYxMDk5Y2VkMDg4IiwiY2lwaGVydGV4dCI6Ijg5Y2QxMGI2MDRlZGIyMGIzZjVkYTAxYzJjMjMzNWI3NWZmN2VhMmE5NzcyODAyODA3YjdhZTU5NzAzMTgzZDg3ZjZjZmM1NDk4NDM2NzM4MmRmNjhiMGFlMTFmOTY2NCJ9";
  const ENC_STYLE =
    "eyJzYWx0IjoiMmY2MGIyOTU2ODhhY2YwNTUxYjk5MTFhYzU0YTI1MjgiLCJpdiI6ImFiZjUxYWMwYzc1YzkyZmUwNGIwNzhjMzIyMmVkMjUyIiwiY2lwaGVydGV4dCI6IjExOTU2MDNlYzU2ODc4MWE1Y2U1NDc2MjBkZTA2MjI4YmY3NzVjYjQyOWE0Y2JkNDY3NTJjMWNiZmMxMzAzN2ViZTEzYTJkZDYyMzQ4OWQ3NjE5NGUxODYxMGU0MjFhNiJ9";
  const FULL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<${ROOT} version="1" type="single">
  <元信息>
    <名称><![CDATA[测试满填]]></名称>
    <性别文本><![CDATA[男性]]></性别文本>
    <年龄>25</年龄>
    <内容类型>original</内容类型>
  </元信息>
  <角色介绍><![CDATA[这是角色介绍的测试内容]]></角色介绍>
  <招呼语><![CDATA[这是开场设计的测试内容]]></招呼语>
  <默认认知><![CDATA[这是默认认知的测试内容]]></默认认知>
  <作者的话><![CDATA[这是作者的话测试]]></作者的话>
  <小剧场><![CDATA[${ENC_XIAOJUCHANG}]]></小剧场>
  <人设><![CDATA[这是人设的测试内容]]></人设>
  <逆境处理><![CDATA[这是逆境的测试内容]]></逆境处理>
  <情节设定><![CDATA[这是情节设定的测试内容]]></情节设定>
  <输出设定><![CDATA[这是输出设定的测试内容]]></输出设定>
  <样例对话与文风><![CDATA[这是样例对话的测试内容]]></样例对话与文风>
  <美化>
    <样式代码><![CDATA[${ENC_STYLE}]]></样式代码>
  </美化>
</${ROOT}>`;

  test("招呼语→opening、默认认知→defaultCognition；性别男", () => {
    const r = parseExternalCharacterXml(FULL_XML);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { character } = r.value;
    expect(character.gender).toBe("male");
    expect(character.opening).toBe("这是开场设计的测试内容");
    expect(character.defaultCognition).toBe("这是默认认知的测试内容");
    expect(character.persona).toBe("这是人设的测试内容");
    expect(character.plotSetting).toBe("这是情节设定的测试内容");
    expect(character.outputSetting).toBe("这是输出设定的测试内容");
    expect(character.sampleDialogue).toBe("这是样例对话的测试内容");
  });

  test("加密的小剧场 + 全局美化 → lockedFields", () => {
    const r = parseExternalCharacterXml(FULL_XML);
    if (!r.ok) throw new Error("parse failed");
    expect(r.value.lockedFields).toContain("小剧场");
    expect(r.value.lockedFields).toContain("全局美化");
    // 加密时 customStyles 应为 null
    expect(r.value.customStyles).toBeNull();
  });

  test("文本字段若是加密 blob → 当作空，不把密文塞进 persona", () => {
    const xml = `<${ROOT}><元信息><名称><![CDATA[加密熊]]></名称></元信息><人设><![CDATA[${ENC_XIAOJUCHANG}]]></人设></${ROOT}>`;
    const r = parseExternalCharacterXml(xml);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.character.persona).toBe("");
  });
});

describe("parseExternalCharacterXml — 明文 <美化><样式代码> 直通", () => {
  // 修复前：外部 `<美化><样式代码>` 明文 CSS 被静默丢弃，pack.globalCss 永远空，
  // 一键导入完成后作者必须额外走 pack studio「粘贴外部美化」按钮才看得到 CSS。
  // 全库审计显示「猫猫大王 3/3 全军覆没」「喵喵 1/2 漏」「keda 1/7 漏」。
  // 修复：parseExternalCharacterXml 把明文 CSS 暴露成 customStyles 字段。

  const xmlWithPlainCss = `<?xml version="1.0" encoding="UTF-8"?>
<${ROOT} version="1" type="single">
  <元信息>
    <名称><![CDATA[小狐狸]]></名称>
  </元信息>
  <美化>
    <样式代码><![CDATA[
.${P}ai_message_bubble { background: rgba(0,0,0,0.5); }
.fox-status { color: gold; }
]]></样式代码>
  </美化>
</${ROOT}>`;

  test("明文 CSS → 暴露成 customStyles 字段，未做翻译", () => {
    const r = parseExternalCharacterXml(xmlWithPlainCss);
    if (!r.ok) throw new Error("parse failed");
    expect(r.value.customStyles).toBeTruthy();
    // 原样保留作者写的 selector（包括旧前缀）—— 翻译由调用方 convertLegacyCss 做
    expect(r.value.customStyles).toContain(`.${P}ai_message_bubble`);
    expect(r.value.customStyles).toContain(".fox-status");
    // 明文不进 lockedFields
    expect(r.value.lockedFields).not.toContain("全局美化");
  });

  test("没有 <美化> 标签 → customStyles = null（不报错）", () => {
    const xml = `<${ROOT}><元信息><名称><![CDATA[裸卡]]></名称></元信息></${ROOT}>`;
    const r = parseExternalCharacterXml(xml);
    if (!r.ok) throw new Error("parse failed");
    expect(r.value.customStyles).toBeNull();
  });

  test("<美化><样式代码> 空字符串 → customStyles = null", () => {
    const xml = `<${ROOT}><元信息><名称><![CDATA[空美化]]></名称></元信息><美化><样式代码></样式代码></美化></${ROOT}>`;
    const r = parseExternalCharacterXml(xml);
    if (!r.ok) throw new Error("parse failed");
    expect(r.value.customStyles).toBeNull();
  });

  test("明文 + 含旧前缀时下游 convertLegacyCss 能正确翻译", () => {
    const r = parseExternalCharacterXml(xmlWithPlainCss);
    if (!r.ok) throw new Error("parse failed");
    const converted = convertLegacyCss(r.value.customStyles ?? "");
    expect(converted.css).toContain(".nj_ai_message_bubble");
    expect(converted.css).not.toContain(`.${P}`);
    expect(converted.note).toBeTruthy();
  });
});

describe("convertLegacyCss — 外部全局美化选择器转换", () => {
  test("class 选择器旧前缀 → nj_", () => {
    const r = convertLegacyCss(`.${P}ai_message_bubble { color: red }`);
    expect(r.css).toBe(".nj_ai_message_bubble { color: red }");
    expect(r.note).not.toBe("");
  });

  test("id 选择器旧前缀 → nj_", () => {
    const r = convertLegacyCss(`#${P}chat_header { background: #000 }`);
    expect(r.css).toContain("#nj_chat_header");
    expect(r.css).not.toContain(P);
  });

  test("没有旧前缀时 note 为空、内容不变", () => {
    const r = convertLegacyCss(".nj_x { color: red }");
    expect(r.note).toBe("");
    expect(r.css).toBe(".nj_x { color: red }");
  });

  test("空输入安全", () => {
    expect(convertLegacyCss("").css).toBe("");
    expect(convertLegacyCss("   ").css).toBe("");
  });

  test("转换后能过 sanitizeAndScopeCss（选择器被认可并 scope）", () => {
    const r = convertLegacyCss(`.${P}ai_message_bubble { color: gold }`);
    const { css } = sanitizeAndScopeCss(r.css, "pack-1");
    expect(css).toContain(
      '[data-character-css="pack-1"] .nj_ai_message_bubble',
    );
    expect(css).toContain("color: gold");
  });

  test("外部专有的 chat-star 规则被 sanitizer 丢弃", () => {
    const r = convertLegacyCss(
      "img[src='/chat-star.png'] { display: none !important }",
    );
    const { css } = sanitizeAndScopeCss(r.css, "pack-1");
    expect(css).not.toContain("chat-star");
  });
});

describe("导入规则一律 render-only（不自动生成 outputGuidance）", () => {
  const WIDGET_RULE_JSON = JSON.stringify([
    {
      ruleName: "小手机",
      regexPattern: "/<PhoneChat>([\\s\\S]*?)<\\/PhoneChat>/g",
      replaceString: '<div class="chat">$1</div>',
      enabled: true,
      visibility: true,
    },
  ]);

  test("角色卡导入：标签型规则的 outputGuidance 为 null（指令交给卡面正文）", () => {
    // 卡面无论有没有文档化这个标签，导入规则都不带触发指令
    const xml = `<${ROOT}><元信息><名称><![CDATA[谢测]]></名称></元信息><输出设定><![CDATA[当涉及线上聊天时，用 <PhoneChat>...</PhoneChat> 包裹内容]]></输出设定><正则规则><![CDATA[${WIDGET_RULE_JSON}]]></正则规则></${ROOT}>`;
    const r = parseExternalCharacterXml(xml);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.rules).toHaveLength(1);
    expect(r.value.rules[0].name).toBe("小手机");
    expect(r.value.rules[0].outputGuidance).toBeNull();
    // 渲染半边照常保留（围栏归一也走过）
    expect(r.value.rules[0].replacement).toContain('<div class="chat">');
  });

  test("纯美化包导入路径（parseExternalRulesJson，无卡面）：同样不生成 outputGuidance", () => {
    const r = parseExternalRulesJson(WIDGET_RULE_JSON);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0].outputGuidance).toBeNull();
  });
});
