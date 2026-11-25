/** CLI only: parse the public template as syntax/data; never execute it. */
import ts from "typescript";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import type { ComposerPrefixSpec } from "../opening/composer-prefix";
import { validPrefixPresets } from "../opening/composer-prefix";
export function publicVariableDeclaration(program: string, name: string): ts.VariableDeclaration {
  const file = ts.createSourceFile(
      "public-template.js",
      program,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    ),
    found: ts.VariableDeclaration[] = [];
  const walk = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    )
      found.push(node);
    ts.forEachChild(node, walk);
  };
  walk(file);
  if (found.length !== 1)
    throw Error("PUBLIC_PREFIX_DECLARATION_BOUNDARY:" + name);
  return found[0];
}
export function extractKnownPublicPrefix(
  input: string,
  id: string,
  triggerColor: string,
  panelColor: string,
): ComposerPrefixSpec {
  if (
    ![triggerColor, panelColor].every((c) =>
      /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/.test(c),
    )
  )
    throw Error("PUBLIC_PREFIX_COLOR_REQUIRED");
  const dom = new JSDOM(input),
    programs = [...dom.window.document.scripts]
      .map((e) => e.textContent ?? "")
      .filter(
        (s) =>
          s.includes("const fixedCoreContent =") && s.includes("bw_draft_v1"),
      );
  if (programs.length !== 1) throw Error("PUBLIC_PREFIX_PROGRAM_REQUIRED");
  const init = publicVariableDeclaration(programs[0], "fixedCoreContent").initializer;
  if (!init || !ts.isNoSubstitutionTemplateLiteral(init))
    throw Error("PUBLIC_PREFIX_STATIC_TEMPLATE_REQUIRED");
  const inner = new JSDOM(init.text),
    doc = inner.window.document,
    script = [...doc.scripts]
      .map((e) => e.textContent ?? "")
      .find(
        (s) =>
          s.includes("let appData =") &&
          s.includes("function getFullTextToSend"),
      );
  const baseCss = doc.querySelector("style")?.textContent;
  if (!script || !baseCss || !doc.getElementById("mufy-bw-wrapper-restored"))
    throw Error("PUBLIC_PREFIX_TEMPLATE_BOUNDARY");
  const state = publicVariableDeclaration(script, "appData").initializer;
  if (
    !state ||
    !ts.isBinaryExpression(state) ||
    !ts.isObjectLiteralExpression(state.right)
  )
    throw Error("PUBLIC_PREFIX_STATE_BOUNDARY");
  const field = state.right.properties.find(
    (p) => ts.isPropertyAssignment(p) && p.name.getText() === "presets",
  );
  if (
    !field ||
    !ts.isPropertyAssignment(field) ||
    !ts.isArrayLiteralExpression(field.initializer)
  )
    throw Error("PUBLIC_PREFIX_PRESETS_REQUIRED");
  const presets = field.initializer.elements.map((p) => {
    if (!ts.isObjectLiteralExpression(p))
      throw Error("PUBLIC_PREFIX_LITERAL_REQUIRED");
    const props = new Map(
      p.properties
        .filter(ts.isPropertyAssignment)
        .map((x) => [x.name.getText(), x.initializer]),
    );
    const i = props.get("id"),
      t = props.get("text");
    if (!i || !t || !ts.isNumericLiteral(i) || !ts.isStringLiteral(t))
      throw Error("PUBLIC_PREFIX_STRING_REQUIRED");
    return { id: "source-" + i.text, text: t.text };
  });
  if (!validPrefixPresets(presets)) throw Error("PUBLIC_PREFIX_DATA_TOO_LARGE");
  const modeStyle = /id="bw-mode-toggle" style="([^"]*)"/.exec(script)?.[1];
  if (!modeStyle) throw Error("PUBLIC_PREFIX_MODE_STYLE_REQUIRED");
  const fontUrl =
    /@font-face\s*\{[^}]*font-family:\s*'SourceHanSerifCN';[^}]*src:\s*url\('([^']+)'\)/.exec(
      baseCss,
    )?.[1];
  if (!fontUrl || new URL(fontUrl).protocol !== "https:")
    throw Error("PUBLIC_PREFIX_FONT_REQUIRED");
  const family =
    "nj_prefix_" +
    id +
    "_" +
    createHash("sha256").update(fontUrl).digest("hex").slice(0, 8);
  const css =
    baseCss
      .replace(/@font-face\s*\{[^}]*\}/, "")
      .replaceAll("border:none!important!;", "")
      .replaceAll("'SourceHanSerifCN'", `'${family}'`) +
    `\n#mufy-fixed-trigger-bw{color:${triggerColor}!important}#mufy-bw-panel{color:${panelColor}}#bw-mode-toggle{${modeStyle};border:0}.bw-item.default-item .bw-content{color:#999;font-style:italic}`;
  dom.window.close();
  inner.window.close();
  return { version: 1, id, css, presets, fontFace: { family, url: fontUrl } };
}
