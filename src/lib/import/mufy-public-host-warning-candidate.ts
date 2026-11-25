/** Candidate only: finite, observed public warning paint; never arbitrary author HTML. */
import postcss from "postcss";

export const PUBLIC_WARNING_CLASSES =
  "z-dropdown mx-auto mb-2 mt-2 flex items-center gap-2 rounded-md px-3";
const CONTAINER =
  ".z-dropdown.mx-auto.mb-2.mt-2.flex.items-center.gap-2.rounded-md.px-3";
const TEXT =
  ".z-dropdown.mx-auto.mb-2.mt-2.flex.items-center.gap-2 span.flex-1";
const MARKER = "compact-css-observed-v1";
export interface PublicWarningObservation {
  observedAt: string;
  height: number;
  width: number;
  bg: string;
  border: string;
  padding: string;
  radius: string;
  font: string;
  size: string;
  line: string;
  spacing: string;
  color: string;
  text: string;
}
export interface PublicWarningContract {
  version: 1;
  text: string;
  height: 28;
  observedWidth: number;
  observedAt: string;
  background: string;
  borderColor: string;
  borderWidth: string;
  radius: "12px";
  padding: "6px 16px";
  fontFamily: string;
  fontSize: "15px";
  lineHeight: "16px";
  letterSpacing: "1px";
  color: string;
}
function rgba(value: string): number[] | null {
  if (/^#[\da-f]{6}$/i.test(value))
    return [1, 3, 5]
      .map((i) => Number.parseInt(value.slice(i, i + 2), 16))
      .concat(1);
  const m =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/.exec(
      value,
    );
  if (!m) return null;
  const result = [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    m[4] === undefined ? 1 : Number(m[4]),
  ];
  return result.slice(0, 3).every((v) => v >= 0 && v <= 255) &&
    result[3] >= 0 &&
    result[3] <= 1
    ? result
    : null;
}
const hasControl = (text: string) =>
  text.split("").some((c) => c.charCodeAt(0) < 32);
const sameColor = (a: string, b: string) => {
  const x = rgba(a),
    y = rgba(b);
  return !!x && !!y && x.every((v, i) => v === y[i]);
};
const fontKey = (value: string) => value.replace(/["'\s]/g, "").toLowerCase();
const safeFont = (value: string) =>
  value.length <= 100 && /^[\w\s,'"\u3400-\u9fff-]+$/.test(value);
const unquote = (value: string) =>
  /^(["'])([^\\]*?)\1$/.exec(value)?.[2] ?? null;
function styles(input: string): string[] {
  const blocks = [...input.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (m) => m[1],
  );
  return blocks.length ? blocks : [input];
}
/** Unknown family or missing/mismatched actual observation returns null (old path). */
export function derivePublicHostWarningContract(
  input: string,
  text: string,
  observation: unknown,
): PublicWarningContract | null {
  if (!observation || typeof observation !== "object") return null;
  const o = observation as PublicWarningObservation;
  if (
    ![
      o.observedAt,
      o.bg,
      o.border,
      o.padding,
      o.radius,
      o.font,
      o.size,
      o.line,
      o.spacing,
      o.color,
      o.text,
    ].every((v) => typeof v === "string")
  )
    return null;
  if (
    !Number.isFinite(Date.parse(o.observedAt)) ||
    o.height !== 28 ||
    !Number.isFinite(o.width) ||
    o.width <= 0 ||
    o.width > 1000
  )
    return null;
  if (
    o.padding !== "6px 16px" ||
    o.radius !== "12px" ||
    o.size !== "15px" ||
    o.line !== "16px" ||
    o.spacing !== "1px"
  )
    return null;
  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 180 ||
    hasControl(text)
  )
    return null;
  if (o.text !== text && unquote(o.text) !== text) return null;
  const vars = new Map<string, string>(),
    container = new Map<string, string>(),
    body = new Map<string, string>(),
    before = new Map<string, string>();
  try {
    for (const block of styles(input)) {
      const root = postcss.parse(block);
      root.walkRules((rule) => {
        const selectors = rule.selectors;
        if (selectors.includes(":root"))
          rule.walkDecls((d) => {
            if (d.prop.startsWith("--")) vars.set(d.prop, d.value.trim());
          });
        const out = selectors.includes(CONTAINER)
          ? container
          : selectors.includes(TEXT)
            ? body
            : selectors.includes(`${TEXT}::before`)
              ? before
              : null;
        if (out)
          rule.walkDecls((d) => {
            out.set(d.prop, d.value.trim());
          });
      });
    }
  } catch {
    return null;
  }
  const resolve = (value: string | undefined): string | null => {
    let s = value;
    const seen = new Set<string>();
    for (let i = 0; s && i < 8; i++) {
      const m = /^var\((--[\w-]+)\)$/.exec(s);
      if (!m) return s;
      if (seen.has(m[1])) return null;
      seen.add(m[1]);
      s = vars.get(m[1]);
    }
    return null;
  };
  if (
    container.get("width") !== "fit-content" ||
    container.get("padding") !== "6px 16px" ||
    container.get("border-radius") !== "12px" ||
    body.get("font-size") !== "0"
  )
    return null;
  // Resolve a variable in the known border color without accepting a CSS program.
  const borderRaw = container.get("border")?.match(/^1px solid (.+)$/)?.[1];
  const borderColor = resolve(borderRaw),
    background = resolve(container.get("background-color")),
    color = resolve(before.get("color")),
    font = before.get("font-family");
  const actualBorder = /^(\d+(?:\.\d+)?)px solid (.+)$/.exec(o.border);
  if (
    !borderColor ||
    !background ||
    !color ||
    !font ||
    !safeFont(font) ||
    !safeFont(o.font) ||
    fontKey(font) !== fontKey(o.font)
  )
    return null;
  if (
    !rgba(background) ||
    !rgba(borderColor) ||
    !rgba(color) ||
    !actualBorder ||
    Number(actualBorder[1]) <= 0 ||
    Number(actualBorder[1]) > 1.1
  )
    return null;
  if (
    !sameColor(background, o.bg) ||
    !sameColor(borderColor, actualBorder[2]) ||
    !sameColor(color, o.color)
  )
    return null;
  if (
    before.get("font-size") !== "15px" ||
    before.get("letter-spacing") !== "1px" ||
    unquote(before.get("content") ?? "") !== text
  )
    return null;
  return {
    version: 1,
    text,
    height: 28,
    observedWidth: o.width,
    observedAt: o.observedAt,
    background: o.bg,
    borderColor: actualBorder[2],
    borderWidth: `${actualBorder[1]}px`,
    radius: "12px",
    padding: "6px 16px",
    fontFamily: o.font,
    fontSize: "15px",
    lineHeight: "16px",
    letterSpacing: "1px",
    color: o.color,
  };
}
function validContract(value: unknown): value is PublicWarningContract {
  if (!value || typeof value !== "object") return false;
  const c = value as PublicWarningContract;
  const keys = [
    "version",
    "text",
    "height",
    "observedWidth",
    "observedAt",
    "background",
    "borderColor",
    "borderWidth",
    "radius",
    "padding",
    "fontFamily",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "color",
  ];
  return (
    Object.keys(c).length === keys.length &&
    Object.keys(c).every((k) => keys.includes(k)) &&
    c.version === 1 &&
    typeof c.text === "string" &&
    c.text.trim().length > 0 &&
    c.text.length <= 180 &&
    !hasControl(c.text) &&
    c.height === 28 &&
    Number.isFinite(c.observedWidth) &&
    c.observedWidth > 0 &&
    c.observedWidth <= 1000 &&
    typeof c.observedAt === "string" &&
    Number.isFinite(Date.parse(c.observedAt)) &&
    typeof c.background === "string" &&
    !!rgba(c.background) &&
    typeof c.borderColor === "string" &&
    !!rgba(c.borderColor) &&
    typeof c.borderWidth === "string" &&
    /^\d+(?:\.\d+)?px$/.test(c.borderWidth) &&
    Number.parseFloat(c.borderWidth) > 0 &&
    Number.parseFloat(c.borderWidth) <= 1.1 &&
    c.radius === "12px" &&
    c.padding === "6px 16px" &&
    typeof c.fontFamily === "string" &&
    safeFont(c.fontFamily) &&
    c.fontSize === "15px" &&
    c.lineHeight === "16px" &&
    c.letterSpacing === "1px" &&
    typeof c.color === "string" &&
    !!rgba(c.color)
  );
}
const escapeText = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function inner(c: PublicWarningContract): string {
  return `<div class="${PUBLIC_WARNING_CLASSES}" data-nj-public-warning="${MARKER}" data-nj-warning-contract="${encodeURIComponent(JSON.stringify(c))}"><span class="flex-1">${escapeText(c.text)}</span></div>`;
}
export function buildPublicHostWarningFloating(
  contract: PublicWarningContract,
): string {
  if (!validContract(contract)) throw Error("INVALID_PUBLIC_WARNING_CONTRACT");
  return `<floating kind="warning-top" pos="top-center" interactive="false">\n${inner(contract)}\n</floating>`;
}
/** Only exact converter-produced plain markup is eligible for native rendering. */
export function parsePublicHostWarningContract(
  srcdoc: string,
): PublicWarningContract | null {
  const encoded = /\bdata-nj-warning-contract="([^"]+)"/.exec(srcdoc)?.[1];
  if (!encoded) return null;
  try {
    const contract: unknown = JSON.parse(decodeURIComponent(encoded));
    if (!validContract(contract)) return null;
    return srcdoc.trim() === inner(contract) ? contract : null;
  } catch {
    return null;
  }
}
