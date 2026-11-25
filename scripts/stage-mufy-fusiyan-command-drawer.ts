/** Static public DOM/literal extraction only; no source script execution. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { publicVariableDeclaration } from "../src/lib/import/mufy-public-prefix-extractor";
import {
  nativeImageSidebarEnvelope,
  validNativeCommands,
  type NativeImageSidebar,
} from "../src/lib/opening/native-image-sidebar";
const startedAt = new Date().toISOString(),
  tick = performance.now(),
  root = "logs/mufy-profiles/full-20261013/next-batch-30-20261028",
  out = root + "/rule-repairs/21/native-command-drawer";
const evidence = JSON.parse(
  await readFile(
    root + "/final-acceptance/21/source-public-component-inventory.json",
    "utf8",
  ),
);
const dom = new JSDOM(evidence.roots[0].frames[5].html),
  doc = dom.window.document;
const programs = [...doc.scripts]
  .map((s) => s.textContent ?? "")
  .filter((s) => s.includes("const defaultCmds ="));
if (programs.length !== 1) throw Error("KNOWN_PUBLIC_COMMAND_PROGRAM_REQUIRED");
const init = publicVariableDeclaration(programs[0], "defaultCmds").initializer;
if (!init || !ts.isArrayLiteralExpression(init))
  throw Error("LITERAL_COMMANDS_REQUIRED");
const commands = init.elements.map((e) => {
  if (!ts.isObjectLiteralExpression(e)) throw Error("LITERAL_COMMAND_REQUIRED");
  const p = new Map(
      e.properties
        .filter(ts.isPropertyAssignment)
        .map((x) => [x.name.getText(), x.initializer]),
    ),
    t = p.get("title"),
    c = p.get("content");
  if (!t || !c || !ts.isStringLiteral(t) || !ts.isStringLiteral(c))
    throw Error("COMMAND_STRINGS_REQUIRED");
  return { title: t.text, content: c.text };
});
const commandDrawer = { id: "censy-fusiyan-v2", commands };
if (!validNativeCommands(commandDrawer) || commands.length !== 10)
  throw Error("COMMAND_LIMITS");
const template = doc.getElementById("cen-cmd-panel-tpl-v2");
if (!template) throw Error("PUBLIC_TEMPLATE_REQUIRED");
const css = template.querySelector("style")?.textContent,
  wrapper = template.querySelector("#Ks_wrapper_v2");
if (!css || !wrapper) throw Error("PUBLIC_SHELL_REQUIRED");
wrapper.classList.add("native-command-sidebar");
wrapper.querySelector("#cen-cmd-ul")?.replaceChildren();
wrapper.querySelector("#Mg_board_v2")?.classList.remove("open");
const spec: NativeImageSidebar = {
  version: 1,
  variant: "command-drawer",
  shellHtml: wrapper.outerHTML,
  css,
  documents: [],
  commandDrawer,
};
const baseline = await readFile(
  root + "/final-acceptance/21/candidate-opening.txt",
  "utf8",
);
if (baseline.includes("native-command-sidebar"))
  throw Error("ALREADY_STAGED_REVIEW");
const candidate = baseline + "\n" + nativeImageSidebarEnvelope(spec),
  hash = (s: string) => createHash("sha256").update(s).digest("hex");
await mkdir(out, { recursive: true });
await writeFile(out + "/sidebar-spec.json", JSON.stringify(spec, null, 2));
await writeFile(out + "/candidate-opening.txt", candidate);
const proof = {
  rank: 21,
  startedAt,
  observedAt: new Date().toISOString(),
  elapsedMs: performance.now() - tick,
  commands: commands.length,
  sourceStorageRead: false,
  authorProgramExecuted: false,
  baselineSha256: hash(baseline),
  candidateSha256: hash(candidate),
  allOriginalCharactersPreserved: candidate.startsWith(baseline),
  baselineRequiresFreshOwnerUiVerification: true,
  ownerUiSaved: false,
  deployed: false,
  fullFidelityAccepted: false,
};
await writeFile(out + "/candidate-proof.json", JSON.stringify(proof, null, 2));
dom.window.close();
console.log(JSON.stringify(proof));
