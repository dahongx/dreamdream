import { expect, test } from "bun:test";
import { isolateMufyIslandLocalFonts } from "../mufy-native-fonts";

test("observed island stack uses installed font aliases without app webfont collision", () => {
  const result = isolateMufyIslandLocalFonts(
    '#censy-island-container{font-family:"Noto Serif SC",STKaiti,KaiTi,serif;color:gold}',
  );
  expect(result.css).toContain(
    '"DearmMufyLocalNotoSerifSC",STKaiti,KaiTi,serif',
  );
  expect(result.css).toContain("color:gold");
  expect(result.localFontFaces).toContain('src:local("Noto Serif SC")');
  expect(result.localFontFaces).not.toContain("url(");
});

test("authored font faces/imports and unrelated stacks keep original font behavior", () => {
  for (const css of [
    '@font-face{font-family:"Noto Serif SC";src:url(/author.woff2)}p{font-family:"Noto Serif SC",STKaiti,KaiTi,serif}',
    '@import url("https://example.test/author.css");p{font-family:"Noto Serif SC",STKaiti,KaiTi,serif}',
    'p{font-family:"Noto Serif SC",serif}',
    'p{content:"font-family: Noto Serif SC,STKaiti,KaiTi,serif"}',
  ]) {
    expect(isolateMufyIslandLocalFonts(css)).toEqual({
      css,
      localFontFaces: "",
    });
  }
  const sanitized = 'p{font-family:"Noto Serif SC",STKaiti,KaiTi,serif}';
  expect(
    isolateMufyIslandLocalFonts(
      sanitized,
      '@import url("/author.css");' + sanitized,
    ),
  ).toEqual({ css: sanitized, localFontFaces: "" });
});
