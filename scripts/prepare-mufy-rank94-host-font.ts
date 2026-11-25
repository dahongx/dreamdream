/** Private owner addition from an actual public computed-style observation. */
import { readFile, writeFile } from "node:fs/promises";
import { sanitizeAndScopeCss } from "../src/lib/styling/whitelist";
const started = performance.now();
const dir = "outputs/mufy-rank91-100-20261111/rank94";
const source = JSON.parse(await readFile(`${dir}/source-host-paint-observed.json`, "utf8")) as {
  observedAt: string;
  sourceButtons: Array<{fontFamily: string}>;
  sourceNote: {fontFamily: string; fontSize: string; lineHeight: string; color: string};
};
const font = '"Noto Serif SC", serif';
if (!source.sourceButtons.every((button: {fontFamily: string}) => button.fontFamily === font)) throw Error("SOURCE_BUTTON_FONT_DISAGREES");
const mono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
if (source.sourceNote.fontFamily !== mono || source.sourceNote.fontSize !== "14px" || source.sourceNote.lineHeight !== "20px" || source.sourceNote.color !== "rgb(209, 213, 219)") throw Error("SOURCE_NOTE_FONT_DISAGREES");
const controls = ["nj_back_button", "nj_mobile_drawer_btn", "nj_review_btn", "nj_header_more_btn", "nj_stage_adjust_btn", "nj_chat_input_replay_btn", "nj_mask_btn", "nj_chat_input_model_btn", "nj_currency_switcher", "nj_chat_send_button"];
const selectors = controls.map(id => `#${id}`.repeat(11));
const css = `/* RANK94_PUBLIC_HOST_FONT: no paint, geometry, action or label changes. */\n${selectors.flatMap(selector => [selector, `${selector} span`]).join(",\n")} {font-family:${font}!important}\n#nj_author_note#nj_author_note#nj_author_note>p.whitespace-pre-wrap {font-family:${mono}!important;font-size:14px!important;line-height:20px!important;color:rgb(209, 213, 219)!important}\n`;
const audit = sanitizeAndScopeCss(css, "rank94-host-font");
if (audit.warnings.length) throw Error("OWNER_FONT_CSS_REJECTED");
await writeFile(`${dir}/host-font-addition.css`, css);
await writeFile(`${dir}/host-font-candidate-audit.json`, JSON.stringify({ observedAt: new Date().toISOString(), sourceObservedAt: source.observedAt, cssLength: css.length, cssWarnings: audit.warnings, elapsedMs: performance.now() - started, ownerSaved: false, accepted: false, preservesExistingPaintAndGeometry: true }, null, 2));
console.log(JSON.stringify({cssLength:css.length,warnings:audit.warnings.length}));
