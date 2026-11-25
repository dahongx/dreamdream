/** Parse saved public literals only. Never evaluate the author's parent program. */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { publicVariableDeclaration } from "../src/lib/import/mufy-public-prefix-extractor";
import {
  type FoxToolkitData,
  validFoxToolkit,
} from "../src/lib/opening/fox-toolkit";
import { nativeImageSidebarEnvelope } from "../src/lib/opening/native-image-sidebar";

const base = "logs/mufy-profiles/full-20261013/next-batch-30-20261028";
const tick = performance.now();
const inventory = JSON.parse(
  await readFile(
    `${base}/final-acceptance/25/source-public-component-inventory.json`,
    "utf8",
  ),
);
if (
  inventory.rank !== 25 ||
  inventory.sourceKey !== "char_83d2456afcbaa1184fd7"
)
  throw Error("SOURCE_IDENTITY_MISMATCH");
const raw: string = inventory.roots[1].frames[1].html;
const dom = new JSDOM(raw);
const script = Array.from(dom.window.document.querySelectorAll("script"))
  .map((node) => node.textContent ?? "")
  .join("\n");
const tree = ts.createSourceFile(
  "public-fox.js",
  script,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
function literal(node: ts.Node): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties.map((property) => {
        if (
          !ts.isPropertyAssignment(property) ||
          (!ts.isIdentifier(property.name) &&
            !ts.isStringLiteral(property.name))
        )
          throw Error("STATIC_PUBLIC_PROPERTY_REQUIRED");
        if (
          ["__proto__", "constructor", "prototype"].includes(property.name.text)
        )
          throw Error("UNSAFE_PUBLIC_PROPERTY");
        return [property.name.text, literal(property.initializer)];
      }),
    );
  throw Error("NON_LITERAL_PUBLIC_DATA_REJECTED");
}
function value(name: string): unknown {
  const node = publicVariableDeclaration(script, name).initializer;
  if (!node) throw Error("PUBLIC_LITERAL_REQUIRED:" + name);
  return literal(node);
}
const data = {
  tracks: value("playlistData") as {
    title: string;
    artist: string;
    src: string;
  }[],
  people: value("npcData") as { name: string; role: string; desc: string }[],
  commands: value("defaultPromptData") as { cmd: string; text: string }[],
  avatars: [
    value("defaultAvatarLeft"),
    value("defaultAvatarRight"),
  ] as string[],
  emoticons: value("emojis") as string[],
};
let css: string | undefined, shell: ts.TemplateExpression | undefined;
function visit(node: ts.Node) {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    if (
      node.left.getText(tree) === "style.innerHTML" &&
      ts.isNoSubstitutionTemplateLiteral(node.right)
    )
      css = node.right.text;
    if (
      node.left.getText(tree) === "widgetContainer.innerHTML" &&
      ts.isTemplateExpression(node.right)
    )
      shell = node.right;
  }
  ts.forEachChild(node, visit);
}
visit(tree);
if (
  !css ||
  !shell ||
  data.tracks.length !== 7 ||
  data.avatars.length !== 2 ||
  !data.commands.length
)
  throw Error("KNOWN_PUBLIC_FOX_TOOLKIT_REQUIRED");
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!,
  );
let shellHtml = shell.head.text;
for (const span of shell.templateSpans) {
  const expression = span.expression.getText(tree);
  let replacement: string;
  if (expression === "defaultAvatarLeft")
    replacement = escapeHtml(data.avatars[0]);
  else if (expression === "defaultAvatarRight")
    replacement = escapeHtml(data.avatars[1]);
  else if (expression.startsWith("playlistData.map("))
    replacement = data.tracks
      .map(
        (song, index) =>
          `<li data-index="${index}"><span>${escapeHtml(song.title)}</span><span class="nj_fox_artist">${escapeHtml(song.artist)}</span></li>`,
      )
      .join("");
  else if (expression.startsWith("npcData.map("))
    replacement = data.people
      .map(
        (person, index) =>
          `<div class="fx-npc-item-btn ${index === 0 ? "active" : ""}" data-index="${index}">${escapeHtml(person.name.split(" ")[0])}</div>`,
      )
      .join("");
  else if (expression === "npcData[0].name")
    replacement = escapeHtml(data.people[0].name);
  else if (expression === "npcData[0].role")
    replacement = escapeHtml(data.people[0].role);
  else if (expression === "npcData[0].desc")
    replacement = escapeHtml(data.people[0].desc);
  else throw Error("UNREVIEWED_PUBLIC_TEMPLATE_EXPRESSION:" + expression);
  shellHtml += replacement + span.literal.text;
}
// Inline declarations become authored classes; no handler, source script or iframe survives.
const inert = new JSDOM(shellHtml),
  body = inert.window.document.body;
body.querySelectorAll("script,iframe,object,embed").forEach((node) => {
  node.remove();
});
let inline = 0;
for (const node of body.querySelectorAll("*")) {
  for (const attribute of Array.from(node.attributes))
    if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
  const style = node.getAttribute("style");
  if (style) {
    const cls = `nj_fox_inline_${inline++}`;
    node.classList.add(cls);
    node.removeAttribute("style");
    css += `\n.${cls}{${style}}`;
  }
}
css += "\n.nj_fox_artist{font-family:monospace;font-size:8px}";
const spec: FoxToolkitData = {
  id: "chenchuang-fox-v1",
  ...data,
  shellHtml: body.innerHTML,
  css,
};
if (!validFoxToolkit(spec)) throw Error("PUBLIC_FOX_DATA_INVALID");
const out = `${base}/rule-repairs/25/native-fox-toolkit`;
await mkdir(out, { recursive: true });
const proof = {
  observedAt: new Date().toISOString(),
  elapsedMs: performance.now() - tick,
  sourceObservedAt: inventory.observedAt,
  sourceRootIndex: 1,
  sourceIndex: 1,
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  authorProgramExecuted: false,
  sourceStorageRead: false,
  sourceFields: {
    tracks: data.tracks.length,
    people: data.people.length,
    commands: data.commands.length,
    avatars: data.avatars.length,
    emoticons: data.emoticons.length,
  },
  templateExpressions: shell.templateSpans.map((span) =>
    span.expression.getText(tree),
  ),
  controllerAcceptance: "separate regression and browser proof required",
  ownerUiSaved: false,
  buildStarted: false,
  wholeCardAccepted: false,
};
await writeFile(`${out}/public-defaults.json`, JSON.stringify(data, null, 2));
await writeFile(`${out}/toolkit-data.json`, JSON.stringify(spec, null, 2));
await writeFile(
  `${out}/native-widget-envelope.txt`,
  nativeImageSidebarEnvelope({
    version: 1,
    variant: "fox-toolkit",
    shellHtml: '<div class="native-fox-toolkit"></div>',
    css: "",
    documents: [],
    foxToolkit: spec,
  }),
);
await writeFile(`${out}/inert-shell.html`, spec.shellHtml);
await writeFile(`${out}/source-style.css`, css);
await writeFile(
  `${out}/literal-extraction-proof.json`,
  JSON.stringify(proof, null, 2),
);
dom.window.close();
inert.window.close();
console.log(JSON.stringify(proof));
