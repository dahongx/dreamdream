import { JSDOM } from "jsdom";
import postcss from "postcss";
import { normalizePublicFrameReplay } from "./mufy-public-frame-replay";

export interface MufyPublicIntroductionInput {
  componentMarkup: string;
  styles?: readonly string[];
  /** Explicit source-parent getComputedStyle snapshot; never inferred. */
  parentTextStyle?: MufyPublicParentTextStyle;
}

export interface MufyPublicParentTextStyle {
  fontSize: string;
  lineHeight: string;
  fontFamily?: string;
  color?: string;
}

export type MufyPublicIntroductionSegment = {
  sequenceIndex: number;
  kind: "html-fragment" | "frame-document" | "unresolved-frame";
  /** Root component iframe index, not a nested iframe inside its srcdoc. */
  sourceFrameIndex?: number;
  /** Raw HTML for ordinary nodes, without embedding the captured iframe. */
  fragmentHtml?: string;
  /** Attribute-decoded original srcdoc, before the finite replay normalizer. */
  sourceDocument?: string;
  documentHtml?: string;
  sourceSrc?: string;
  /** Audit-only original outer element for an unresolved frame, never rendered. */
  sourceFrameMarkup?: string;
  unresolvedReason?: string;
};

export interface MufyPublicIntroductionDerivation {
  segments: MufyPublicIntroductionSegment[];
  /** Only resolved segments are rendered; unresolved must be reviewed first. */
  codeRenderContent: string;
  documents: string[];
  readyForPreparation: boolean;
  unresolved: { sequenceIndex: number; sourceFrameIndex?: number; reason: string; sourceSrc?: string; sourceAncestorSummary?: string }[];
  ledger: {
    sourceIframeCount: number;
    sourceStyleCount: number;
    parentTextStyle: {
      captured: boolean;
      source: "caller-provided-source-computed-values" | "not-provided";
      adoptedValues: MufyPublicParentTextStyle | null;
      appliedTo: "ordinary-html-fragments-only";
      appliedFragmentCount: number;
      priority: "zero-specificity-no-important";
    };
    ranges: {
      beforeFrameIndex: number | null;
      afterFrameIndex: number | null;
      disposition: "preserved-fragment" | "empty-wrapper-only";
      sequenceIndex?: number;
      clonedAncestorTags: string[];
    }[];
    frames: { sourceFrameIndex: number; sequenceIndex: number; disposition: "srcdoc-document" | "unresolved"; srcdocCharacters: number | null }[];
    /** Empty means all source ranges/frames have dispositions, not UI success. */
    missing: string[];
    browserAcceptance: "not-assessed";
  };
}

const EMPTY_WRAPPERS = new Set(["DIV", "SPAN", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "ASIDE", "NAV"]);

function parentTextStyle(value: unknown): MufyPublicParentTextStyle | undefined {
  if (value === undefined) return undefined;
  const fail = (field: string): never => { throw Error(`MUFY_INTRODUCTION_INVALID_PARENT_TEXT_STYLE:${field}`); };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("parentTextStyle");
  const supplied = value as Record<string, unknown>;
  const allowed = new Set(["fontSize", "lineHeight", "fontFamily", "color"]);
  for (const key of Object.keys(supplied)) if (!allowed.has(key)) fail(key);
  const safeString = (key: string, optional = false): string | undefined => {
    const candidate = supplied[key];
    if (candidate === undefined && optional) return undefined;
    if (typeof candidate !== "string" || !candidate.trim() || candidate.length > 512) fail(key);
    const trimmed = (candidate as string).trim();
    // Computed values have no declarations, priorities, escapes or HTML.
    if (/[;{}<>\\@!\x00-\x1f]|\/\*|\*\//u.test(trimmed)) fail(key);
    return trimmed;
  };
  const fontSize = safeString("fontSize")!;
  const lineHeight = safeString("lineHeight")!;
  const fontFamily = safeString("fontFamily", true);
  const color = safeString("color", true);
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)px$/i.test(fontSize) || !Number.isFinite(Number.parseFloat(fontSize))) fail("fontSize");
  if (lineHeight !== "normal" && (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/i.test(lineHeight) || !Number.isFinite(Number.parseFloat(lineHeight)))) fail("lineHeight");
  if (fontFamily && !/^(?:"[^"]+"|'[^']+'|[\p{L}\p{N}_-]+(?: +[\p{L}\p{N}_-]+)*)(?: *, *(?:"[^"]+"|'[^']+'|[\p{L}\p{N}_-]+(?: +[\p{L}\p{N}_-]+)*))*$/u.test(fontFamily)) fail("fontFamily");
  if (color && !(
    /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color) ||
    /^[a-z]+$/i.test(color) && !/^(?:inherit|initial|unset|revert)$/i.test(color) ||
    /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([a-z\d.+,% /-]+\)$/i.test(color)
  )) fail("color");
  return { fontSize, lineHeight, ...(fontFamily ? { fontFamily } : {}), ...(color ? { color } : {}) };
}

function textBaselineCss(style: MufyPublicParentTextStyle): string {
  return ":where(html,body){" + [
    `font-size:${style.fontSize}`, `line-height:${style.lineHeight}`,
    style.fontFamily ? `font-family:${style.fontFamily}` : "",
    style.color ? `color:${style.color}` : "",
  ].filter(Boolean).join(";") + "}";
}

function significant(node: Node): boolean {
  if (node.nodeType === 3) return !!node.textContent?.trim();
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  // Empty named anchors or styled wrappers may be the target of author code.
  // All controls, media, style/script and non-wrapper tags are retained even
  // when their text is empty. Only genuinely empty anonymous wrappers go away.
  if (!EMPTY_WRAPPERS.has(element.tagName) || element.attributes.length > 0) return true;
  return [...element.childNodes].some(significant);
}

function cloneOrdinaryRange(
  document: Document,
  root: HTMLElement,
  previous: HTMLIFrameElement | null,
  next: HTMLIFrameElement | null,
): { html: string; meaningful: boolean; clonedAncestorTags: string[] } {
  const range = document.createRange();
  if (previous) range.setStartAfter(previous);
  else range.setStart(root, 0);
  if (next) range.setEndBefore(next);
  else range.setEnd(root, root.childNodes.length);
  const fragment = range.cloneContents();
  const meaningful = [...fragment.childNodes].some(significant);
  const clonedAncestorTags: string[] = [];
  // Range clones partial boundary ancestors, but not its common ancestor.
  // Re-add that shallow chain when two sibling frames share a nested wrapper.
  let contents: Node = fragment;
  let ancestor: Node | null = range.commonAncestorContainer;
  if (ancestor.nodeType !== 1) ancestor = ancestor.parentNode;
  while (ancestor && ancestor !== root && root.contains(ancestor)) {
    if (ancestor.nodeType === 1) {
      const wrapper = ancestor.cloneNode(false) as Element;
      wrapper.appendChild(contents);
      contents = wrapper;
      clonedAncestorTags.push(wrapper.tagName.toLowerCase());
    }
    ancestor = ancestor.parentNode;
  }
  const container = document.createElement("div");
  container.appendChild(contents);
  range.detach();
  return { html: container.innerHTML, meaningful, clonedAncestorTags };
}

/** Keep source paint only for DOM this fragment actually owns. A copied
 * unrelated widget selector can otherwise trip legacy floating detectors. */
function fragmentStyles(document: Document, styles: readonly string[]): string {
  if (!styles.length) return "";
  const root = postcss.parse(styles.join("\n"));
  const inKeyframes = (node: postcss.ChildNode): boolean => {
    let parent: postcss.Node | undefined = node.parent;
    while (parent) {
      if (parent.type === "atrule" && /keyframes$/i.test((parent as postcss.AtRule).name)) return true;
      parent = parent.parent;
    }
    return false;
  };
  const scriptText = [...document.scripts].map(script => script.textContent ?? "").join("\n");
  const stateClass = /\.(?:active|is-active|open|is-open|closed|expanded|collapsed|selected|visible|hidden|show|playing)(?![\w-])/g;
  const matches = (selector: string): boolean => {
    const structural = selector
      .replace(/::[\w-]+(?:\([^)]*\))?/g, "")
      .replace(/:(?:hover|focus-visible|focus-within|focus|active|visited|checked|disabled|enabled|target)(?![\w-])/g, "")
      .replace(/\[(?:open|checked|disabled|aria-expanded|aria-selected|data-state)(?:\s*[^\]]*)?\]/g, "")
      .replace(stateClass, "").trim() || "*";
    try { if (document.querySelector(structural)) return true; } catch { /* fall through for unsupported author selector syntax */ }
    // Dynamic author nodes may be created by a public script in this fragment.
    // Never infer ownership merely from an unrelated widget's stylesheet.
    const identities = [...structural.replace(/\[[^\]]*\]/g, "").matchAll(/([.#])([a-zA-Z_][\w-]*)/g)];
    return identities.length > 0 && identities.every(([, sigil, name]) => {
      if (scriptText.includes(name)) return true;
      return sigil === "#" ? !!document.getElementById(name) : document.getElementsByClassName(name).length > 0;
    });
  };
  root.walkComments(comment => { comment.remove(); });
  root.walkRules(rule => {
    if (inKeyframes(rule)) return;
    const selectors = rule.selectors.filter(matches);
    if (!selectors.length) rule.remove();
    else rule.selectors = selectors;
  });
  const animationValues: string[] = [...document.querySelectorAll("[style]")].map(element => element.getAttribute("style") ?? "");
  root.walkDecls(declaration => { if (!inKeyframes(declaration)) animationValues.push(declaration.value); });
  root.walkAtRules(rule => {
    if (/keyframes$/i.test(rule.name) && !animationValues.some(value => value.split(/[\s,]+/).includes(rule.params.trim()))) rule.remove();
  });
  root.walkAtRules(rule => { if (rule.nodes && rule.nodes.length === 0) rule.remove(); });
  return root.toString();
}

function isolatedFragment(html: string, styles: readonly string[], textStyle?: MufyPublicParentTextStyle): string {
  const isolated = new JSDOM("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
  const { document } = isolated.window;
  document.body.innerHTML = html;
  const css = fragmentStyles(document, styles);
  if (css.trim()) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }
  if (textStyle) {
    const baseline = document.createElement("style");
    baseline.setAttribute("data-mufy-captured-parent-text", "true");
    baseline.textContent = textBaselineCss(textStyle);
    document.head.insertBefore(baseline, document.head.firstChild);
  }
  const serialized = "<!DOCTYPE html>" + document.documentElement.outerHTML;
  isolated.window.close();
  return normalizePublicFrameReplay(serialized).html;
}

/**
 * Derive an ordered introduction from author-public DOM only. JSDOM stays
 * inert: no scripts are executed and no remote frame/resource is fetched.
 * The ledger establishes coverage, never runtime loading or UI acceptance.
 */
export function deriveMufyPublicIntroductionSequence(
  input: MufyPublicIntroductionInput,
): MufyPublicIntroductionDerivation {
  if (typeof input?.componentMarkup !== "string") throw Error("MUFY_INTRODUCTION_INVALID:componentMarkup");
  const styles = input.styles ?? [];
  if (!Array.isArray(styles) || styles.some(css => typeof css !== "string")) throw Error("MUFY_INTRODUCTION_INVALID:styles");
  const capturedParentTextStyle = parentTextStyle(input.parentTextStyle);
  const dom = new JSDOM(`<body>${input.componentMarkup}</body>`);
  const document = dom.window.document;
  const root = document.body;
  const frames = [...root.querySelectorAll("iframe")];
  const result: MufyPublicIntroductionDerivation = {
    segments: [], codeRenderContent: "", documents: [], readyForPreparation: false, unresolved: [],
    ledger: { sourceIframeCount: frames.length, sourceStyleCount: styles.length,
      parentTextStyle: { captured: !!capturedParentTextStyle, source: capturedParentTextStyle ? "caller-provided-source-computed-values" : "not-provided", adoptedValues: capturedParentTextStyle ? { ...capturedParentTextStyle } : null, appliedTo: "ordinary-html-fragments-only", appliedFragmentCount: 0, priority: "zero-specificity-no-important" },
      ranges: [], frames: [], missing: [], browserAcceptance: "not-assessed" },
  };

  for (let index = 0; index <= frames.length; index++) {
    const previous = index ? frames[index - 1] : null;
    const next = frames[index] ?? null;
    const range = cloneOrdinaryRange(document, root, previous, next);
    const rangeLedger: MufyPublicIntroductionDerivation["ledger"]["ranges"][number] = {
      beforeFrameIndex: next ? index : null,
      afterFrameIndex: previous ? index - 1 : null,
      disposition: range.meaningful ? "preserved-fragment" : "empty-wrapper-only",
      clonedAncestorTags: range.clonedAncestorTags,
    };
    if (range.meaningful) {
      const sequenceIndex = result.segments.length;
      rangeLedger.sequenceIndex = sequenceIndex;
      result.segments.push({ sequenceIndex, kind: "html-fragment", fragmentHtml: range.html,
        documentHtml: isolatedFragment(range.html, styles, capturedParentTextStyle) });
      if (capturedParentTextStyle) result.ledger.parentTextStyle.appliedFragmentCount++;
    }
    result.ledger.ranges.push(rangeLedger);
    if (!next) continue;

    const sourceDocument = next.getAttribute("srcdoc");
    const sourceSrc = next.getAttribute("src") ?? undefined;
    const sequenceIndex = result.segments.length;
    const disclosure = next.closest("details");
    if (disclosure) {
      const reason = "FRAME_INSIDE_DETAILS_REQUIRES_BOUND_CONTROL";
      const summary = [...disclosure.children].find(child => child.tagName === "SUMMARY")?.textContent?.trim();
      result.segments.push({ sequenceIndex, kind: "unresolved-frame", sourceFrameIndex: index, sourceSrc,
        sourceFrameMarkup: next.outerHTML, sourceDocument: sourceDocument ?? undefined, unresolvedReason: reason });
      result.unresolved.push({ sequenceIndex, sourceFrameIndex: index, reason, sourceSrc, sourceAncestorSummary: summary });
      result.ledger.frames.push({ sourceFrameIndex: index, sequenceIndex, disposition: "unresolved", srcdocCharacters: sourceDocument?.length ?? null });
    } else if (sourceDocument?.trim()) {
      result.segments.push({ sequenceIndex, kind: "frame-document", sourceFrameIndex: index,
        sourceDocument, documentHtml: normalizePublicFrameReplay(sourceDocument).html });
      result.ledger.frames.push({ sourceFrameIndex: index, sequenceIndex, disposition: "srcdoc-document", srcdocCharacters: sourceDocument.length });
    } else {
      const reason = sourceSrc ? "REMOTE_FRAME_WITHOUT_READABLE_SRCDOC" : "EMPTY_OR_MISSING_SRCDOC";
      result.segments.push({ sequenceIndex, kind: "unresolved-frame", sourceFrameIndex: index, sourceSrc, sourceFrameMarkup: next.outerHTML, unresolvedReason: reason });
      result.unresolved.push({ sequenceIndex, sourceFrameIndex: index, reason, sourceSrc });
      result.ledger.frames.push({ sourceFrameIndex: index, sequenceIndex, disposition: "unresolved", srcdocCharacters: sourceDocument?.length ?? null });
    }
  }

  for (const segment of result.segments) {
    if (segment.documentHtml === undefined) continue;
    // The existing renderer uses triple-backtick envelopes. Never silently
    // generate an ambiguous envelope around an author's literal fence line.
    if (/\r?\n[ \t]*```/.test(segment.documentHtml)) {
      result.unresolved.push({ sequenceIndex: segment.sequenceIndex, sourceFrameIndex: segment.sourceFrameIndex, reason: "AUTHOR_DOCUMENT_CONTAINS_FENCE_BOUNDARY" });
    }
    result.documents.push(segment.documentHtml);
  }
  result.readyForPreparation = result.unresolved.length === 0;
  // Partial documents remain audit data only. Do not emit a ready-looking
  // import envelope when a native control/frame relationship is unresolved.
  result.codeRenderContent = result.readyForPreparation
    ? result.documents.map(html => `\`\`\`html\n${html}\n\`\`\``).join("\n\n")
    : "";
  dom.window.close();
  return result;
}
