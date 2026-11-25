/** Narrow owner-theme candidate from the observed source. No deploy or UI writes. */
import { readFile, writeFile } from "node:fs/promises";
import postcss from "postcss";
import { sanitizeAndScopeCss } from "../src/lib/styling/whitelist";
const started = performance.now();
const dir = "outputs/mufy-rank81-90-20261111/rank81";
const capture = JSON.parse(await readFile(`${dir}/public-capture.json`, "utf8")) as { styles: string[]; observedAt: string; sourceUrl: string };
const source = postcss.parse(capture.styles.join("\n"));
const base = ".relative.flex.w-full.flex-col.gap-2.p-3";
const paint = new Set(["background", "background-color", "color", "border", "border-color", "border-top", "border-radius", "box-shadow", "backdrop-filter", "-webkit-backdrop-filter", "text-shadow", "font-family", "-webkit-text-fill-color", "opacity"]);
const rules: string[] = [];
const derivation: Array<{ sourceSelector: string; target: string; properties: string[] }> = [];
function transfer(from: string, to: string, properties = paint) {
  source.walkRules(rule => {
    if (!rule.selectors.includes(from)) return;
    const declarations = rule.nodes.filter(node => node.type === "decl" && properties.has(node.prop.toLowerCase())).map(node => node.clone());
    if (!declarations.length) return;
    const result = postcss.rule({ selector: to });
    for (const declaration of declarations) { if (declaration.type === "decl") declaration.important = true; result.append(declaration); }
    rules.push(result.toString());
    derivation.push({ sourceSelector: from, target: to, properties: declarations.map(node => node.type === "decl" ? node.prop : "") });
  });
}
const id = (name: string, count = 11) => `#${name}`.repeat(count);
transfer(base, id("nj_chat_input_container"));
transfer("textarea", id("nj_chat_input_box"), new Set(["background-color", "border", "border-radius", "backdrop-filter"]));
transfer(`${base} textarea`, id("nj_chat_input_textarea"));
transfer(`${base} textarea::placeholder`, `${id("nj_chat_input_textarea")}::placeholder`);
transfer(`${base} .flex.h-7.flex-1.justify-end button`, id("nj_chat_send_button"));
transfer(`${base} .flex.h-7.flex-1.justify-end button:not(:disabled)`, `${id("nj_chat_send_button")}:not(:disabled)`);
transfer(`${base} .flex.h-7.flex-1.justify-end button:not(:disabled):hover`, `${id("nj_chat_send_button")}:not(:disabled):hover`);
transfer(`${base} .flex.h-7.flex-1.justify-end button svg`, `${id("nj_chat_send_button")} svg`);
const css = `/* Observed rank81 composer paint. Geometry and functional labels remain native. */\n${rules.join("\n")}`;
if (derivation.length < 7) throw Error("SOURCE_COMPOSER_RULES_INCOMPLETE");
const probe = sanitizeAndScopeCss(css, "audit81-composer");
if (probe.warnings.length) throw Error(JSON.stringify(probe.warnings));
await writeFile(`${dir}/composer-paint-candidate.css`, css);
await writeFile(`${dir}/composer-paint-candidate-audit.json`, JSON.stringify({ observedAt: new Date().toISOString(), sourceObservedAt: capture.observedAt, sourceUrl: capture.sourceUrl, derivation, cssWarnings: probe.warnings, elapsedMs: performance.now() - started, accepted: false, requiresActualUiSaveAndRecheck: true }, null, 2));
console.log(JSON.stringify({ rules: derivation.length, cssLength: css.length, warnings: probe.warnings }));
