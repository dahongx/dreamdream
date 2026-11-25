import { expect, test } from "bun:test";
import { adaptMufyHostCss } from "../import/mufy-host-css-adaptation";
import { sanitizeAndScopeCss } from "../styling/whitelist";
import { prepareMufyMigration } from "../import/mufy-migration";
test("reply contract selectors are scoped without weakening platform sanitizer", () => {
  const result = adaptMufyHostCss(
    ".phone-wrapper .recalled {display:none;color:red}",
    ["<div class='phone-wrapper'><div class='recalled'></div></div>"],
  );
  expect(result.css).toContain("#nj_chat_messages .phone-wrapper .recalled");
  expect(result.css).toContain("display:none");
  expect(sanitizeAndScopeCss(result.css, "fixture").warnings).toEqual([]);
});
test("nonportable chrome and unsafe declarations are explicitly deferred", () => {
  const result = adaptMufyHostCss(
    "@import url('https://fonts.example/font'); .nj_ai_message_bubble {color:red;pointer-events:none} button {display:none}",
    [],
  );
  expect(result.css).toContain("color:red");
  expect(result.css).not.toContain("pointer-events");
  expect(result.css).not.toContain("button");
  expect(result.deferred.length).toBeGreaterThanOrEqual(3);
  expect(sanitizeAndScopeCss(result.css, "fixture").warnings).toEqual([]);
});
test("authorized local age fixes metadata while preserving original persona", () => {
  const prompt =
    "<CharaPrompt>姓名：测试\n年龄：40岁\n人物正文</CharaPrompt><Greeting>开场</Greeting>";
  const input = {
    detail: {
      characterId: "54aa723f-f61a-40ff-89cb-2c003388675d",
      name: "测试",
      age: 38,
      greeting: "开场",
    },
    promptRecord: { characterName: "测试", prompt, source: {} },
  };
  expect(prepareMufyMigration(input).character.age).toBe(38);
  const fixed = prepareMufyMigration({ ...input, preferLocalAge: true });
  expect(fixed.character.age).toBe(40);
  expect(fixed.character.persona).toBe(
    prepareMufyMigration(input).character.persona,
  );
  expect(
    fixed.issues.some(
      (issue) => issue.code === "AGE_FROM_AUTHORIZED_LOCAL_BASELINE",
    ),
  ).toBe(true);
});
