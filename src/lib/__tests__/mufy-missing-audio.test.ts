import { expect, test } from "bun:test";
import { prepareMufyMigration } from "../import/mufy-migration";
import { omitUnavailableMufyAudio } from "../import/mufy-missing-audio";

const audio = "https://assets.example/unavailable.mp3";
const image = "https://assets.example/missing.png";
function fixture() {
  return prepareMufyMigration({
    detail: {
      characterId: "54aa723f-f61a-40ff-89cb-2c003388675d",
      name: "测试",
      greeting: `<audio src="${audio}"></audio><img src="${image}">`,
      codeRenderContent: `<audio src="${audio}"></audio>`,
    },
    promptRecord: {
      source: {},
      characterName: "测试",
      prompt:
        "<CharaPrompt>人物设定保持原样</CharaPrompt><Greeting>开场</Greeting>",
    },
  });
}
test("missing audio remains strict unless explicitly authorized", () => {
  const prepared = fixture();
  expect(
    omitUnavailableMufyAudio(prepared, [{ url: audio, ok: false }], false),
  ).toEqual([]);
  expect(prepared.character.opening).toContain(audio);
});
test("authorized omission removes only unavailable audio, preserving image and persona", () => {
  const prepared = fixture();
  prepared.issues.push({
    level: "error",
    code: "GLOBAL_CSS_REQUIRES_ADAPTATION",
    message: "CSS remains blocked",
  });
  expect(
    omitUnavailableMufyAudio(
      prepared,
      [
        { url: audio, ok: false },
        { url: image, ok: false },
      ],
      true,
    ),
  ).toEqual([audio]);
  expect(prepared.character.opening).not.toContain(audio);
  expect(prepared.character.opening).toContain(image);
  expect(prepared.character.opening).not.toContain('src=""');
  expect(prepared.character.opening).toContain(
    'data-mufy-audio-omitted="true"',
  );
  expect(prepared.character.persona).toBe("人物设定保持原样");
  expect(
    prepared.issues.some(
      (x) => x.code === "GLOBAL_CSS_REQUIRES_ADAPTATION" && x.level === "error",
    ),
  ).toBe(true);
  expect(
    prepared.issues.some(
      (x) =>
        x.code === "MISSING_AUDIO_OMITTED_WITH_APPROVAL" &&
        x.level === "warning",
    ),
  ).toBe(true);
});
test("available songs and avatar requirements are never discarded", () => {
  const prepared = fixture();
  expect(
    omitUnavailableMufyAudio(
      prepared,
      [{ url: audio, ok: true, dataUrl: "data:audio/mpeg;base64,AQ==" }],
      true,
    ),
  ).toEqual([]);
  prepared.character.avatarUrl = audio;
  expect(
    omitUnavailableMufyAudio(prepared, [{ url: audio, ok: false }], true),
  ).toEqual([]);
});
test("explicit media policy handles extensionless image and audio by known MIME", () => {
  const prepared=fixture();
  const opaque="https://assets.example/public";
  prepared.character.opening=`<img src="${opaque}">`;
  prepared.character.avatarUrl=opaque;
  expect(omitUnavailableMufyAudio(prepared,[{url:opaque,ok:false,contentType:"image/gif"}],true,true)).toEqual([opaque]);
  expect(prepared.character.avatarUrl).toBeNull();
  expect(prepared.character.opening).toContain("data-mufy-image-omitted");
  expect(prepared.issues.some(issue=>issue.code==="MISSING_IMAGE_OMITTED_WITH_APPROVAL")).toBe(true);
});
