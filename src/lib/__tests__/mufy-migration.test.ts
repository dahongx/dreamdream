import { describe, expect, test } from "bun:test";
import {
  extractEmbeddedMufyHostCss,
  extractEmbeddedReplyCss,
  extractMufyThinkToggleCss,
  extractMufyWarningText,
  extractPromptSection,
  mufyTextSimilarity,
  normalizeMufyCharacterName,
  parseMufyPromptSourceText,
  prepareMufyMigration,
  selectMufyRoleDetail,
  selectMufyRuntimeDetail,
  selectPromptRecord,
} from "@/lib/import/mufy-migration";

const prompt = `master mentions <CharaPrompt> but does not close it
<CharaPrompt>人物设定</CharaPrompt>
<AdversityHandling>逆境规则</AdversityHandling>
<DefaultCognition>默认认知</DefaultCognition>
<Greeting>Prompt 开场</Greeting>
<PlotSetting>剧情</PlotSetting>
<OutputSetting>输出</OutputSetting>
<StyleSamples>文风</StyleSamples>`;

describe("mufy migration parser", () => {
  test("preserves an empty host audio element in the sandbox component", () => {
    const detail={characterId:"audio-card",name:"fixture",greeting:"开场",optimizationCode:'<style>.mufy_chat_header{color:red}</style><audio id="source-player" loop autoplay></audio>',codeRenderContent:'<div>原组件</div>'};
    const result=prepareMufyMigration({detail,promptRecord:{characterName:"fixture",prompt,source:{}},adaptRuntime:true});
    expect(result.beautification.openingComponent).toContain('<audio id="source-player" loop autoplay></audio>');
    expect(result.beautification.openingComponent).toContain('原组件');
    expect(result.beautification.globalCss).not.toContain('<audio');
    expect(result.audit.sourceHashes.optimizationCode).toBe(Bun.CryptoHasher.hash('sha256',detail.optimizationCode,'hex'));
    expect(()=>prepareMufyMigration({detail:{...detail,optimizationCode:detail.optimizationCode+'<script>unexpected()</script>'},promptRecord:{characterName:"fixture",prompt,source:{}},adaptRuntime:true})).toThrow('style');
  });
  test("recovers notice content from optimization CSS and either pseudo element", () => {
    expect(extractMufyWarningText('<style>.mx-auto.mb-2.mt-2.flex.rounded-md span.text-sm::after{content:"source notice"}</style>')).toBe("source notice");
    expect(extractMufyWarningText('<style>.mx-auto.mb-2.mt-2.flex.rounded-md span::before{content:"second notice"}</style>')).toBe("second notice");
  });
  test("uses an authenticated browser snapshot as the detail source", () => {
    const result = selectMufyRuntimeDetail(
      {
        version: 3,
        detail: {
          data: {
            characterId: "c413ba62-c798-43f2-ad84-e5a50641603e",
            name: "余斯是",
            greeting: "开场",
          },
        },
      },
      "c413ba62-c798-43f2-ad84-e5a50641603e",
    );

    expect(result?.detail.name).toBe("余斯是");
    expect(result?.detail.greeting).toBe("开场");
  });

  test("normalizes only a trailing version note", () => {
    expect(normalizeMufyCharacterName("赵漳平(新增婚后开场白) ")).toBe(
      "赵漳平",
    );
    expect(normalizeMufyCharacterName("A（版本二）")).toBe("A");
    expect(normalizeMufyCharacterName("文攸临/新增双开场白物品栏")).toBe("文攸临");
    expect(normalizeMufyCharacterName("文攸临/张三")).toBe("文攸临/张三");
    expect(normalizeMufyCharacterName("文攸临/新增角色张三")).toBe("文攸临/新增角色张三");
  });

  test("uses the nearest opening tag before the closing tag", () => {
    expect(extractPromptSection(prompt, "CharaPrompt")).toBe("人物设定");
  });

  test("accepts assembled text and extracted module JSONL sources", () => {
    expect(
      selectPromptRecord(parseMufyPromptSourceText(prompt), "任意").prompt,
    ).toBe(prompt);
    const jsonl = `${JSON.stringify({
      character_name: "甲",
      required_modules: {
        CharaPrompt: "甲设定",
        Greeting: "甲开场",
      },
      optional_modules: {},
      module_order: ["CharaPrompt", "Greeting"],
    })}\n${JSON.stringify({
      character_name: "乙",
      required_modules: {
        CharaPrompt: "乙设定",
        Greeting: "乙开场",
      },
      optional_modules: {},
      module_order: ["CharaPrompt", "Greeting"],
    })}`;
    const source = parseMufyPromptSourceText(jsonl);
    expect(selectPromptRecord(source, "乙").prompt).toContain(
      "<CharaPrompt>\n乙设定\n</CharaPrompt>",
    );
  });

  test("compares visible greeting text instead of presentation HTML", () => {
    expect(
      mufyTextSimilarity(
        '<style>.a{color:red}</style><div class="a">你好，余斯是。</div>',
        '<section class="b">你好余斯是</section>',
      ),
    ).toBe(1);
  });

  test("selects a detail from a browser export by normalized name", () => {
    const detail = selectMufyRoleDetail(
      {
        cards: {
          arbitrary: {
            body: {
              data: {
                characterId: "role-1",
                name: "赵漳平(新增婚后开场白)",
                greeting: "hello",
              },
            },
          },
        },
      },
      "赵漳平",
    );
    expect(detail.characterId).toBe("role-1");
  });

  test("selects the matching record from a multi-card prompt export", () => {
    const record = selectPromptRecord(
      {
        characters: [
          { character_name: "甲", found: true, prompt: "x" },
          { character_name: "赵漳平", found: true, prompt },
        ],
      },
      "赵漳平(新增婚后开场白)",
    );
    expect(record.prompt).toBe(prompt);
  });

  test("preserves original theater and only adapts global selector prefixes", () => {
    const prepared = prepareMufyMigration({
      detail: {
        characterId: "role-1",
        name: "赵漳平(新增婚后开场白)",
        greeting: "线上开场",
        optimizationCode: "<style>.mufy_ai_message_bubble{color:red}</style>",
        codeRenderContent:
          '```html\n<style>.card{color:white}</style><div class="card">原卡</div>\n```',
        avatarUrl: "https://example.com/avatar.webp",
        backgroundUrl: "https://example.com/cover.webp",
        tags: ["标签"],
        gender: 1,
        age: 35,
      },
      promptRecord: {
        characterName: "赵漳平",
        prompt,
        source: {},
      },
    });

    expect(prepared.character.opening).toBe("线上开场");
    expect(prepared.beautification.globalCss).toContain(
      ".nj_ai_message_bubble",
    );
    expect(prepared.beautification.globalCss).not.toContain(".card");
    expect(prepared.beautification.openingComponent).not.toContain(
      "mufy_ai_message_bubble",
    );
    expect(prepared.beautification.openingComponent).toContain(
      '<div class="card">原卡</div>',
    );
    expect(prepared.audit.greetingMatchesPrompt).toBe(false);
    expect(prepared.audit.greetingTextSimilarity).toBeGreaterThanOrEqual(0);
    expect(
      prepared.issues.some((issue) => issue.code === "GREETING_DIFFERS"),
    ).toBe(true);
  });

  test("recovers only explicit Mufy host skin rules embedded in theater HTML", () => {
    const prepared = prepareMufyMigration({
      detail: {
        characterId: "role-host-skin",
        name: "余斯是",
        greeting: "线上开场",
        optimizationCode: "",
        codeRenderContent: [
          "<style>:root{--c-border:#d5e5eb}.scene-card{display:block}",
          ".mufy_ai_message_bubble,.mufy_user_message_bubble{border:1px solid var(--c-border)}",
          ".mufy_message_narration{color:#d5e5eb;background-image:linear-gradient(90deg,#456,#789);background-size:100% 40%;text-shadow:0 0 3px #456}</style>",
          "<div class='scene-card'>演绎正文</div>",
        ].join(""),
      },
      promptRecord: {
        characterName: "余斯是",
        prompt,
        source: {},
      },
    });

    expect(prepared.beautification.globalCss).toContain(
      ".nj_ai_message_bubble",
    );
    expect(prepared.beautification.globalCss).toContain("--c-border");
    expect(prepared.beautification.globalCss).toContain("text-shadow");
    expect(prepared.beautification.globalCss).not.toContain("background-image");
    expect(prepared.beautification.globalCss).not.toContain("background-size");
    expect(prepared.beautification.globalCss).not.toContain(".scene-card");
    expect(prepared.beautification.openingComponent).toContain(".scene-card");
  });

  test("recovers CSS for model-emitted HTML without promoting unrelated theater styles", () => {
    const css = extractEmbeddedReplyCss(
      `<style>
        :root { --reply-border: #abc; }
        .chat-container-reforged { width: 320px; }
        .avatar-reforged { width: 36px; height: 36px; }
        .simple-details-card[open] > div { border: 1px solid var(--reply-border); }
        .hidden-text { display: none; }
        .opening-only-carousel { width: 900px; }
      </style>`,
      [
        '<div class="chat-container-reforged"><img class="avatar-reforged"><span class="hidden-text"></span></div>',
        '<details class="simple-details-card"></details>',
      ],
    );

    expect(css).toContain(".chat-container-reforged");
    expect(css).toContain(".avatar-reforged");
    expect(css).toContain(".simple-details-card[open]");
    expect(css).toContain(
      ".nj_ai_message_bubble .chat-container-reforged .hidden-text",
    );
    expect(css).toContain("--mufy-reply-0-reply-border");
    expect(css).not.toContain(".opening-only-carousel");
  });

  test("keeps phone colors private while preserving inline emphasis highlights", () => {
    const phone = extractEmbeddedReplyCss(
      "<style>:root{--text-primary:#1a1a1a;--phone-text:var(--text-primary)}.phone{color:var(--phone-text)}</style>",
      ['<div class="phone"></div>'],
    );
    expect(phone).not.toContain("--text-primary:");
    expect(phone).toContain("--mufy-reply-0-text-primary:#1a1a1a");
    expect(phone).toContain("var(--mufy-reply-0-text-primary)");
    expect(phone).toContain("color:var(--mufy-reply-0-phone-text)");
    const host = extractEmbeddedMufyHostCss(
      "<style>b,strong,.mufy_message_narration{color:#e0e7ef;background-image:linear-gradient(#456,#789);background-size:100% 40%}</style>",
    );
    expect(host).toContain(".mufy_emphasis_text");
    expect(host).toMatch(/mufy_emphasis_text\s*\{[^}]*background-image/);
    expect(host).not.toMatch(
      /mufy_message_narration\s*\{[^}]*background-image/,
    );
    const privateEmphasis = extractEmbeddedMufyHostCss(
      "<style>.mufy_message_narration{color:#e0e7ef}strong{color:red;background:yellow}</style>",
    );
    expect(privateEmphasis).not.toContain(".mufy_emphasis_text");
    expect(privateEmphasis).not.toContain("yellow");
  });

  test("adapts Mufy's animated reasoning toggle to Dearm's stable button", () => {
    const css = extractMufyThinkToggleCss(`<style>
      @keyframes btn-underline-slide { 0% { width: 0; } 50% { width: 100%; } }
      @keyframes btn-text-breathe { 0% { opacity: .7; } 50% { opacity: 1; } }
      .group.flex.w-fit.cursor-pointer span.font-bold::after {
        content: '⩌ _ ⩌';
        animation: btn-text-breathe 3.5s infinite;
      }
    </style>`);

    expect(css).toContain('.mufy_message_think[data-collapsed="true"]');
    expect(css).toContain("⩌ _ ⩌");
    expect(css).toContain("mufy-think-line-slide");
    expect(css).not.toContain('.mufy_message_think[aria-expanded="true"]');
    expect(css).not.toContain(".group.flex.w-fit.cursor-pointer");
  });

  test("adapts a static custom reasoning label without depending on one card", () => {
    const css = extractMufyThinkToggleCss(`<style>
      .group.flex.w-fit.cursor-pointer.select-none.items-center.text-sm {
        border: 1px solid rgba(224, 224, 235, .6);
        min-width: 200px;
      }
      .group.flex.w-fit.cursor-pointer.select-none.items-center.text-sm::before {
        content: "没有你谁在乎明天";
        letter-spacing: 1px;
      }
      .group.flex.w-fit.cursor-pointer.select-none.items-center.text-sm:hover::before {
        color: white;
      }
      .group.flex.w-fit.cursor-pointer.select-none.items-center.text-sm svg {
        display: none;
      }
    </style>`);

    expect(css).toContain('.mufy_message_think[data-collapsed="true"]');
    expect(css).toContain('content: "没有你谁在乎明天"');
    expect(css).toContain(":hover::before");
    expect(css).toContain("> svg");
    expect(css).not.toContain(".group.flex.w-fit.cursor-pointer");
  });

  test("recovers a customized dismissible Mufy host warning as a floating banner", () => {
    const codeRenderContent = `<style>
      .z-dropdown.mx-auto span::before { content: "这个世界好坏，还好我也不是什么好东西"; }
      .scene-card { color: white; }
    </style><div class="scene-card">演绎正文</div>`;
    expect(extractMufyWarningText(codeRenderContent)).toBe(
      "这个世界好坏，还好我也不是什么好东西",
    );

    const prepared = prepareMufyMigration({
      detail: {
        characterId: "role-warning",
        name: "余斯是",
        greeting: "线上开场",
        optimizationCode: "",
        codeRenderContent,
      },
      promptRecord: { characterName: "余斯是", prompt, source: {} },
    });
    expect(prepared.beautification.openingComponent).toContain(
      '<floating kind="warning-top"',
    );
    expect(prepared.beautification.openingComponent).toContain(
      "这个世界好坏，还好我也不是什么好东西",
    );
  });

  test("blocks a prompt-declared runtime sidebar that detail API did not export", () => {
    const prepared = prepareMufyMigration({
      detail: {
        characterId: "role-2",
        name: "沈知衡",
        greeting: "开场",
        optimizationCode: "<style>.plain{color:red}</style>",
        codeRenderContent: '<div class="plain">只有小剧场</div>',
        avatarUrl: "https://example.com/avatar.webp",
        backgroundUrl: "https://example.com/cover.webp",
      },
      promptRecord: {
        characterName: "沈知衡",
        prompt: prompt.replace(
          "<OutputSetting>",
          "<OutputSetting><侧边栏指令区>必须输出</侧边栏指令区>",
        ),
        source: {},
      },
    });

    expect(
      prepared.issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.code === "RUNTIME_COMPONENT_NOT_EXPORTED",
      ),
    ).toBe(true);
  });
});
