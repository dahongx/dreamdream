/** Prepare this batch from authorized archives and saved public DOM captures. */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareMufyMigration, sha256 } from "../src/lib/import/mufy-migration";
import { parseExternalCharacterXml, parseExternalRulesJson } from "../src/lib/import/external-card";
import { mufyQuoteCompatibilityRules } from "../src/lib/import/mufy-quote-compatibility";
import { mufyStatusIndentRules } from "../src/lib/import/mufy-status-indent";
import { adaptMufyCompletionContract } from "../src/lib/import/mufy-completion-contract";
import { normalizePublicFrameReplay } from "../src/lib/import/mufy-public-frame-replay";
import { routeOpeningContent } from "../src/lib/opening/content";
import { JSDOM } from "jsdom";
import { assertMufyPublicCaptureIntegrity } from "../src/lib/import/mufy-public-capture-integrity";

interface Capture {
  name: string;
  sourceUrl: string;
  observedAt: string;
  greeting: string;
  componentMarkup?: string;
  documents: string[];
  styles: string[];
  authorNote: string;
  profileText: string;
  headerText: string;
  media: { avatar?: string; background?: string };
  speech?: { avatar: Record<string, string>; bubble: Record<string, string> };
}

const root = resolve("outputs/mufy-rank81-90-20261111");
const rank = Number(process.argv[2]);
if (!Number.isInteger(rank) || rank < 81 || rank > 90) {
  throw Error("Expected one rank from 81 through 90");
}
const started = performance.now();
const manifest = JSON.parse(await readFile(resolve("outputs/mufy-local-archives-rank52-100-20261109/manifest.json"), "utf8"));
const row = manifest.rows.find((item: { rank: number }) => item.rank === rank);
if (!row) throw Error("Archive metadata missing");
const dir = join(root, `rank${rank}`);
const capture: Capture = JSON.parse(await readFile(join(dir, "public-capture.json"), "utf8"));
assertMufyPublicCaptureIntegrity(capture);
if (capture.name !== row.name || capture.sourceUrl !== row.sourceUrl) {
  throw Error("Public identity binding mismatch");
}
const prompt = await readFile(row.promptPath, "utf8");
if (sha256(prompt) !== row.promptSha256) throw Error("Authorized archive hash mismatch");
if (!capture.greeting.trim() || !capture.observedAt) throw Error("Public opening not observed");
const profileLines = capture.profileText.split("\n").map(s => s.trim()).filter(Boolean);
const replayNormalizations: Array<{ scope: string; removedPlatformScripts: number }> = [];
const componentCount = capture.componentMarkup
  ? (capture.componentMarkup.match(/<iframe\b/gi) ?? []).length
  : capture.documents.length;
const componentDocuments = capture.documents.slice(0, componentCount).map((html, index) => {
  const normalized = normalizePublicFrameReplay(html);
  replayNormalizations.push({ scope: `component-${index}`, removedPlatformScripts: normalized.removedPlatformScripts });
  return normalized.html;
});
// Some authors use ordinary public HTML for the introduction, with no iframe.
// An empty iframe inventory must not silently discard that visible component.
if (componentCount === 0 && capture.componentMarkup?.trim()) {
  componentDocuments.push(normalizePublicFrameReplay(capture.componentMarkup).html);
}
function replayOpening(flatten: boolean): string {
  const document = new JSDOM(capture.greeting).window.document;
  for (const element of document.querySelectorAll("iframe")) {
    const html = element.getAttribute("srcdoc");
    if (!html) throw Error("Public opening iframe lacks its observed document");
    const normalized = normalizePublicFrameReplay(html);
    replayNormalizations.push({ scope: "opening-frame", removedPlatformScripts: normalized.removedPlatformScripts });
    const template = document.createElement("template");
    if (flatten) {
      const route = routeOpeningContent(normalized.html);
      if (route.kind !== "iframe") throw Error("Expected one public opening document");
      template.innerHTML = route.srcdoc;
    } else template.innerHTML = `<artifact>${normalized.html}</artifact>`;
    element.replaceWith(template.content);
  }
  return document.body.innerHTML;
}
const publicOpening = /<iframe\b/i.test(capture.greeting) ? replayOpening(false) : capture.greeting;
const prepared = prepareMufyMigration({
  adaptRuntime: true,
  preferLocalAge: true,
  detail: {
    characterId: new URL(capture.sourceUrl).searchParams.get("roleId")!,
    name: capture.name,
    greeting: publicOpening,
    codeRenderContent: componentDocuments.map(html => "```html\n" + html + "\n```").join("\n\n"),
    optimizationCode: capture.styles.map(css => "<style>" + css + "</style>").join("\n"),
    description: profileLines[2] ?? null,
    creatorDescription: capture.authorNote,
    tags: (capture.headerText.split("\n")[1] ?? "").split("/").map(s => s.trim()).filter(Boolean),
    avatarUrl: capture.media.avatar ?? null,
    backgroundUrl: capture.media.background ?? null,
  },
  promptRecord: { characterName: row.name, prompt },
});
const errors = prepared.issues.filter(item => item.level === "error");
if (errors.length) throw Error(errors.map(item => item.code).join(","));
const character = {
  ...prepared.character,
  outputSetting: adaptMufyCompletionContract(prepared.character.outputSetting ?? "") || null,
};
const transferNormalizations: string[] = [];
if (capture.speech) {
  const avatarCss = Object.entries(capture.speech.avatar).map(([key, value]) => `${key}:${value}`).join(";");
  const bubbleCss = Object.entries(capture.speech.bubble).map(([key, value]) => `${key}:${value}`).join(";");
  const gutter = Math.max(0, -Number.parseFloat(capture.speech.avatar.left || "0"));
  character.opening = await new HTMLRewriter()
    .on('img[alt="avatar"]', {
      element(element) { element.setAttribute("style", [element.getAttribute("style"), avatarCss, `min-width:${capture.speech!.avatar.width};min-height:${capture.speech!.avatar.height}`].filter(Boolean).join(";")); },
    })
    .on(".mufy_ai_message_bubble", {
      element(element) { element.setAttribute("style", [element.getAttribute("style"), bubbleCss, `max-width:calc(100% - ${gutter}px);margin-left:${gutter}px`].filter(Boolean).join(";")); },
    })
    .transform(new Response(character.opening)).text();
  transferNormalizations.push("opening: preserve measured public speech-avatar layout without source utility CSS");
}
for (const key of Object.keys(character) as Array<keyof typeof character>) {
  const value = character[key];
  if (typeof value === "string" && value.includes("\r")) {
    Object.assign(character, { [key]: value.replace(/\r\n?/g, "\n") });
    transferNormalizations.push(`${key}: XML newline normalization`);
  }
}
if (character.opening !== character.opening.trim()) {
  character.opening = character.opening.trim();
  transferNormalizations.push("opening: importer trims boundary whitespace");
}
const rules = [
  ...mufyQuoteCompatibilityRules([character.opening ?? "", character.outputSetting ?? ""]),
  ...mufyStatusIndentRules([character.opening ?? "", character.outputSetting ?? ""]),
];
if (capture.greeting.includes("/chat-star.png")) {
  rules.push({
    ruleName: "迁移兼容：原站公开星形装饰图片地址",
    regexPattern: `/(<img\\b[^>]*\\bsrc=["'])/chat-star\\.png(["'][^>]*>)/g`,
    replaceString: "$1https://chat.mufy.ai/chat-star.png$2",
    enabled: true,
    visibility: false,
  });
}
if (/<iframe\b/i.test(capture.greeting)) {
  const replayBody = replayOpening(true);
  const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
  rules.unshift({
    ruleName: "迁移兼容：公开开场独立文档（非来源作者规则）",
    regexPattern: `/^\\s*${escapeRegex(character.opening.slice(0, 500))}[\\s\\S]*$/`,
    replaceString: `<artifact><style>${capture.styles.join("\n")}\nhtml,body{height:auto!important;min-height:0!important;margin:0;background:transparent!important}*,*::before,*::after{box-sizing:border-box}img,video{max-width:100%}</style>${replayBody.replace(/\$(?=[1-9])/g, "&#36;")}</artifact>`,
    enabled: true,
    visibility: false,
  });
  transferNormalizations.push("opening: exact captured document replay through the existing isolated iframe renderer");
}
function field(name: string, value: unknown): string {
  return `<${name}><![CDATA[${String(value ?? "").replaceAll("]]>", "]]]]><![CDATA[>")}]]></${name}>`;
}
const gender = { male: "男", female: "女", other: "其他", unset: "" }[character.gender];
const xml = `<?xml version="1.0" encoding="UTF-8"?><mufy-character><元信息>${field("名称", character.name)}${field("性别文本", gender)}${field("年龄", character.age)}${field("NSFW", character.nsfw)}${field("AI", character.isAi)}${field("内容类型", character.contentType)}${field("头像", character.avatarUrl)}${field("封面图", character.coverImageUrl)}</元信息><标签>${character.tags.map(tag => field("tag", tag)).join("")}</标签>${field("角色介绍", character.bio)}${field("作者的话", character.creatorNote)}${field("人设", character.persona)}${field("逆境处理", character.adversity)}${field("默认认知", character.defaultCognition)}${field("招呼语", character.opening)}${field("情节设定", character.plotSetting)}${field("输出设定", character.outputSetting)}${field("样例对话与文风", character.sampleDialogue)}<美化>${field("样式代码", prepared.beautification.globalCss)}</美化>${field("小剧场", prepared.beautification.openingComponent)}${field("正则规则", JSON.stringify(rules))}</mufy-character>`;
const parsed = parseExternalCharacterXml(xml);
if (!parsed.ok) throw Error("XML roundtrip parse failed");
for (const key of Object.keys(character) as Array<keyof typeof character>) {
  if (JSON.stringify(parsed.value.character[key]) !== JSON.stringify(character[key])) {
    throw Error(`XML roundtrip field mismatch ${key}`);
  }
}
const expectedRules = parseExternalRulesJson(JSON.stringify(rules));
const rulesEqual = rules.length === 0
  ? parsed.value.rules.length === 0
  : expectedRules.ok && JSON.stringify(parsed.value.rules) === JSON.stringify(expectedRules.value);
if (!rulesEqual || parsed.value.openingComponent !== prepared.beautification.openingComponent) {
  throw Error(JSON.stringify({ code: "XML_ROUNDTRIP_COMPONENT_OR_RULE_MISMATCH", expectedRulesOk: expectedRules.ok, rules: rules.length, componentExpected: prepared.beautification.openingComponent?.length, componentActual: parsed.value.openingComponent?.length, componentEqual: parsed.value.openingComponent === prepared.beautification.openingComponent }));
}
const revision = process.argv[3] ?? "prepared";
if (!/^prepared(?:-v[1-9][0-9]*)?$/.test(revision)) throw Error("Invalid preparation revision");
const out = join(dir, revision);
await mkdir(out, { recursive: true });
await writeFile(join(out, "ui-import.xml"), xml, { flag: "wx" });
await writeFile(join(out, "compatibility-rules.json"), JSON.stringify(rules, null, 2), { flag: "wx" });
await writeFile(join(out, "audit.json"), JSON.stringify({
  rank, sourceKey: row.sourceKey, sourceUrl: row.sourceUrl, observedAt: capture.observedAt,
  preparedAt: new Date().toISOString(), promptSha256: row.promptSha256,
  xmlSha256: sha256(xml), xmlRoundtripVerified: true,
  issues: prepared.issues, transferNormalizations, replayNormalizations, accepted: false,
  sourceRuleCapturePresent: false,
  note: "Compatibility rules are generated locally. Source-specific rule completeness still needs browser verification.",
}, null, 2), { flag: "wx" });
await appendFile(join(root, "timing-runs.jsonl"), JSON.stringify({
  rank, kind: "local-process-wall", observedAt: new Date().toISOString(),
  stage: "prepare-public-dom-xml", elapsedMs: performance.now() - started, tokenUsage: null,
}) + "\n");
console.log(JSON.stringify({ rank, xml: join(out, "ui-import.xml"), characters: xml.length, issues: prepared.issues.map(item => item.code), accepted: false }));

