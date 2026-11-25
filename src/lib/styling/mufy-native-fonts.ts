import { generate, parse, walk } from "css-tree";

const LOCAL_SERIF_ALIAS = "DearmMufyLocalNotoSerifSC";

/** Keep the observed island's system-font fallback independent of app webfonts. */
export function isolateMufyIslandLocalFonts(
  css: string,
  sourceCss = css,
): {
  css: string;
  localFontFaces: string;
} {
  let ast: ReturnType<typeof parse>;
  let sourceAst: ReturnType<typeof parse>;
  try {
    ast = parse(css);
    sourceAst = sourceCss === css ? ast : parse(sourceCss);
  } catch {
    return { css, localFontFaces: "" };
  }
  let authorLoadsFonts = false;
  walk(sourceAst, (node) => {
    if (
      node.type === "Atrule" &&
      node.name &&
      /^(font-face|import)$/i.test(node.name)
    ) {
      authorLoadsFonts = true;
    }
  });
  if (authorLoadsFonts) return { css, localFontFaces: "" };

  let isolated = false;
  walk(ast, (node) => {
    if (
      node.type !== "Declaration" ||
      node.property?.toLowerCase() !== "font-family" ||
      !node.value ||
      typeof node.value === "string"
    )
      return;
    const stack = generate(node.value)
      .replace(/["'\s]/g, "")
      .toLowerCase();
    if (stack !== "notoserifsc,stkaiti,kaiti,serif") return;
    node.value = parse(`"${LOCAL_SERIF_ALIAS}",STKaiti,KaiTi,serif`, {
      context: "value",
    });
    isolated = true;
  });
  return isolated
    ? {
        css: generate(ast),
        // local() resolves installed fonts, never the app's downloaded @font-face.
        localFontFaces: `@font-face{font-family:"${LOCAL_SERIF_ALIAS}";src:local("Noto Serif SC");font-style:normal;font-weight:100 900;font-display:swap}`,
      }
    : { css, localFontFaces: "" };
}
