/**
 * CSS allowlist walker for v1 W8.
 *
 * Goal: take a creator-authored CSS string and return a normalized,
 * scoped, safe version that can be injected into the chat page without
 * letting the creator hijack the host UI.
 *
 * Approach: a hand-rolled minimal CSS parser. Postcss would be more
 * robust but adds 100KB+ to the bundle for one job; this v1 walker only
 * needs to:
 *   - Strip rules whose selector doesn't start with an `nj_*` token
 *     (or an explicit safe-tag selector like `details summary`)
 *   - Strip dangerous declarations (position: fixed/sticky, pointer-events,
 *     z-index > 100, cursor: none, @import, url() to bare http)
 *   - Strip @-rules other than @keyframes / @media / @supports
 *   - Force a scope prefix `[data-character-css="<id>"]` on every selector
 *
 * Test coverage hits the cases listed in v1-foundation.md §5.4.
 */

import { renameLegacySelectors } from "@/lib/import/legacy-format";
import { closeStyleBlockAtEof } from "./style-block-boundary";

const ALLOWED_AT_RULES = new Set(["keyframes", "media", "supports"]);

const FORBIDDEN_PROPERTIES = new Set([
  "position", // only `fixed` / `sticky` are dangerous; we filter by value below
  "pointer-events",
  "cursor", // ditto — only `none` / `inherit` from a hidden parent could hurt
]);

// Allowed-prefix selectors. Bare `details` / `details summary` / `pre` /
// `strong` etc are accepted because they're declared as "creator-stylable"
// in the special-tag contract.
const SAFE_TAG_PREFIXES = [
  "details ",
  "details>",
  "details,",
  "pre",
  "strong",
  "code",
  "em",
  "ul",
  "ol",
  "li",
  "blockquote",
];

export interface SanitizeCssResult {
  css: string;
  warnings: string[];
}

export function sanitizeAndScopeCss(
  input: string,
  scopeAttr: string,
  // 内部递归标记：@media / @supports 的 body 会再调本函数一次。发送按钮复位
  // 规则只能在最外层追加一次，嵌套调用里不追加（否则每个 @media 块里都塞一遍）。
  _nested = false,
  _explicitControlSkins?: ReadonlySet<string>,
): SanitizeCssResult {
  const warnings: string[] = [];

  if (!input || !input.trim()) return { css: "", warnings };

  // Render-time fallback: 外部选择器前缀 → nj_ 全量改名。寄情和来源平台的
  // selector 公约是镜像，差一个前缀（详见 docs/contracts/nj-selectors.md §2-3）。
  // import 通路里 convertLegacyCss 已经做过同样替换，但只对走「粘贴外部美化」
  // 按钮的入口生效；其他路径（手粘到 globalCss 编辑器、老数据、脚本写库、
  // 跨 pack 复制）的旧前缀字面量过不了下面的白名单。这层在 render time
  // 兜底，确保只要选择器命名是旧体系就能命中 nj_* 元素。两个前缀都是
  // 唯一 token，全量替换不会误伤其他内容。
  const renamed = renameLegacySelectors(input);
  if (renamed !== input) warnings.push("外部选择器前缀已自动转换为 nj_");

  // Strip markdown code fences. The global-css generator prompt forbids them,
  // but the model still occasionally wraps output in ```css ... ```. Left in,
  // the opening ```css line fuses with the first selector and the whole rule
  // gets blocked. Cheap to strip here so every call site (generator stream,
  // direct paste, script writes) is covered.
  const defenced = renamed.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");

  // Strip <style>...</style> wrappers if creator pasted them.
  const stripped = defenced
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, block: string) => closeStyleBlockAtEof(block))
    .replace(/<style[^>]*>/gi, "")
    .replace(/<\/style>/gi, "");

  // Strip @import statements — block external network fetches.
  //
  // 坑（谢寻状态栏白块根因）：朴素的 `@import[^;]*;?` 遇到 URL 里的分号就截断。
  // Google Fonts 常见写法 `@import url('...css2?family=X:wght@0,400;0,700;1,400');`
  // 权重列表里全是分号，正则只吃到第一个 `;` 就停 → 剩下的 `0,700;1,400...');`
  // 变成垃圾粘到紧跟其后的规则选择器前面 → 那条规则（往往是定义局部变量的
  // 作用域容器，如 `.status-wrapper{--status-bg:...}`）整条报废 → 变量丢失、
  // 背景 var() 解析失败 → 白块。这是通用 bug，凡是带 Google Fonts @import 的包
  // 都中招。修法：显式吃掉 url(...) / 引号串（内部分号一并吞），再吃可选 media
  // 与结尾分号；同时兜底扫掉任何残余的裸 @import 行。
  let css = stripped.replace(
    /@import\s+(?:url\([^)]*\)|["'][^"']*["'])\s*[^;]*;?/gi,
    () => {
      warnings.push("@import is not allowed");
      return "";
    },
  );
  // 兜底：清掉不带 url()/引号的异常 @import 残留（正常 CSS 少见，但防御性保留）。
  css = css.replace(/@import[^;]*;?/gi, () => {
    warnings.push("@import is not allowed");
    return "";
  });

  // Strip CSS comments (cheap normalization — keeps things simpler downstream).
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");

  const tokens = tokenize(css);
  // Preserve authored rules while walking; the final toolbar-family adapter
  // resolves model-only skins consistently for both legacy and new cards.
  const explicitControlSkins = _explicitControlSkins ?? collectControlSkins(tokens);
  const out: string[] = [];
  const scopeSel = `[data-character-css="${scopeAttr}"]`;

  for (const tok of tokens) {
    if (tok.type === "at-rule") {
      const name = tok.name.toLowerCase();
      if (!ALLOWED_AT_RULES.has(name)) {
        warnings.push(`@${name} is not allowed`);
        continue;
      }
      // For allowed at-rules, recurse into the body
      if (name === "keyframes") {
        out.push(`@${tok.name} ${tok.prelude} {\n${tok.body}\n}`);
      } else {
        const inner = sanitizeAndScopeCss(tok.body, scopeAttr, true, explicitControlSkins);
        warnings.push(...inner.warnings);
        out.push(`@${tok.name} ${tok.prelude} {\n${inner.css}\n}`);
      }
    } else if (tok.type === "rule") {
      const selectors = tok.prelude
        // Mufy's model ID is on an inner label. Dearm's public ID is the
        // clickable button itself. Preserve the authored outer shell, with
        // enough specificity to beat the source's inner-label border reset.
        .replace(/button(?:\[[^\]]+\]|\.[\w-]+)*:has\(\s*#nj_chat_input_model_btn\s*\)/g,
          '#nj_chat_input_model_btn#nj_chat_input_model_btn#nj_chat_input_model_btn')
        // Source model trigger lives inside the input box; our accessible
        // toolbar is its sibling. Map this known contract, not arbitrary DOM.
        .replace(/#nj_chat_input_box\s+(?=[#.]nj_chat_input_model_btn\b)/g, "#nj_chat_input_container ")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const safeSelectors: string[] = [];
      let hasBareBody = false;
      for (const sel of selectors) {
        const rewrite = rewriteRootSelector(sel, scopeSel);
        if (rewrite === null) {
          // Blocked by isSelectorAllowed
          warnings.push(`selector blocked: ${sel}`);
          continue;
        }
        safeSelectors.push(rewrite.sel);
        if (rewrite.isBareBody) hasBareBody = true;
      }
      if (safeSelectors.length === 0) continue;

      // 让 mask / 金银币开关「跟随 replay 按钮」的美化 —— 它们是寄情新增元素，
      // 外部创作者 CSS 不认识（实查 88 包 0 个提到 #nj_mask_btn/#nj_currency_switcher，
      // 却有 65 个用 id 针对 #nj_chat_input_replay_btn）。这里做选择器镜像：任何命中
      // #nj_chat_input_replay_btn 的规则，自动复制一份作用到 #nj_mask_btn 与
      // #nj_currency_switcher，使它们跟着 replay 按钮一起被创作者样式覆盖，不再露出
      // 平台默认紫框。零逐卡改动。见 docs/exec-plans/active/input-box-skin.md。
      const mirrored = mirrorSemanticControls(safeSelectors, explicitControlSkins);

      // Split background properties from other properties if this is a bare body rule
      if (hasBareBody) {
        const { background, other } = splitBackgroundProperties(
          tok.body,
          warnings,
        );

        // Emit background properties to #nj_background_image
        if (background.trim()) {
          out.push(`${scopeSel} #nj_background_image {\n${background}\n}`);
        }

        // Emit other properties to the scope root
        if (other.trim()) {
          out.push(`${safeSelectors.join(", ")} {\n${other}\n}`);
        }
      } else {
        const sanitizedBody = sanitizeDeclarations(
          tok.body,
          warnings,
          safeSelectors.join(", "),
        );
        if (!sanitizedBody.trim()) continue;
        out.push(`${safeSelectors.join(", ")} {\n${sanitizedBody}\n}`);
        const maskSelectors = [...safeSelectors, ...mirrored].filter((selector) =>
          /[#.]nj_mask_btn(?:\[[^\]]+\]|:[\w-]+)*$/.test(selector),
        );
        const maskAccent = controlAccent(sanitizedBody);
        const mirroredBody = modelControlChrome(sanitizedBody,
          safeSelectors.some((selector) => /[#.]nj_header_more_btn\b/.test(selector)));
        if (mirrored.length > 0) {
          const model = mirrored.filter((s) => s.includes("#nj_chat_input_model_btn"));
          const other = mirrored.filter((s) => !s.includes("#nj_chat_input_model_btn"));
          if (other.length && mirroredBody) out.push(`${other.join(", ")} {\n${mirroredBody}\n}`);
          // The model label is wider than an icon. Never copy replay sizing,
          // transforms, text content or positioning into this control.
          const modelBody = modelControlChrome(sanitizedBody);
          if (model.length && modelBody) out.push(`${model.join(", ")} {\n${modelBody}\n}`);
        }
        if (maskSelectors.length && maskAccent) {
          out.push(`${maskSelectors.join(", ")} {\n  --nj-mask-active-color: ${maskAccent};\n}`);
        }
      }
    }
  }

  // ---- 发送按钮防「大框包小框」复位 ----
  // 问题场景：很多外部包用宽泛的 `button:not(#foo):not(#bar) { border; background }`
  // 给所有按钮统一加框，但漏了排除 #nj_chat_send_button（发送按钮在输入框大框
  // 内部），导致发送按钮被套一个小框 → 视觉上「大框包小框」。发送按钮是平台
  // chrome，不该被包染框（和 #nj_chat_input_box 一个道理）。
  //
  // 这里不去逐条改写包的 button 选择器（太脆），而是在末尾追加一条复位。
  // 关键坑：这些包的 button 选择器塞了大量带 id 的 `:not(#nj_message_actions_delete)`
  // 之类，specificity 被灌到 (7,11,29) 这种量级，普通「两个 id」的复位 (2,1,x)
  // 根本压不过。解决办法是「重复 id」把 specificity 拉爆——`#id#id#id...`（同一
  // id 重复 N 次）是合法 CSS，每次 +1 个 id 权重。重复 10 次 → (10,1,0)，第一位
  // 10 已经大于任何现实中包能写出的 id 数，稳赢且排在最后。只清框相关属性
  // （border/背景/阴影/模糊），不动图标颜色。仅在有包 CSS 时追加。
  if (!_nested && out.length > 0) {
    out.push(importedControlLayout(scopeSel, tokens));
    const boostedSendBtn = "#nj_chat_send_button".repeat(10);
    out.push(
      `${scopeSel} ${boostedSendBtn} {\n` +
        "  border: none !important;\n" +
        "  background: transparent !important;\n" +
        "  box-shadow: none !important;\n" +
        "  backdrop-filter: none !important;\n" +
        "  -webkit-backdrop-filter: none !important;\n" +
        "}",
    );

    // ---- 面具(mask)激活态标记 ----
    // mask 按钮平时跟随创作者美化（见 mirrorSemanticControls），但「戴面具 vs 没戴」
    // 的激活区别会被创作者的 !important 抹平，看不出戴没戴。这里给激活态
    // (#nj_mask_btn[data-active]) 追加一条创作者压不掉的**发光描边**标记：
    //   - outline + box-shadow 优先用同组按钮描边色，缺失时回退 currentColor：创作者
    //     美化过的卡取其主题色（融入风格），没美化的取平台默认色。平台无需认识任何
    //     创作者变量。outline 是独立属性，创作者基本不写、天然不冲突。
    //   - 作者已有 mask 激活态时不注入；否则重复 id 保证提示不被通用按钮规则抹掉。
    //   - 只作用于 [data-active]（戴面具时），没戴时无描边 → 区别明显。
    const boostedMaskActive = `#nj_mask_btn[data-active]${"#nj_mask_btn".repeat(9)}`;
    if (!hasAuthoredMaskActiveSkin(tokens)) out.push(
      `${scopeSel} ${boostedMaskActive} {\n` +
        "  outline: 2px solid var(--nj-mask-active-color, currentColor) !important;\n" +
        "  outline-offset: 1px !important;\n" +
        "  box-shadow: 0 0 6px var(--nj-mask-active-color, currentColor) !important;\n" +
        "}",
    );
  }

  return { css: out.join("\n\n"), warnings };
}

/** Skins own paint; Dearm owns functional control layout and labels.
 * Stage/background isolation remains gated on verified source provenance.
 * Empty pseudo-elements (borders/ornaments) remain; only text replacements on
 * known host controls are suppressed. Message/status-card content is untouched.
 */
function importedControlLayout(scope: string, tokens: Token[]): string {
  const header = ["nj_back_button", "nj_mobile_drawer_btn", "nj_review_btn", "nj_header_more_btn", "nj_stage_adjust_btn", "nj_header_follow_btn", "nj_header_message_btn"];
  const toolbar = ["nj_chat_input_replay_btn", "nj_mask_btn", "nj_chat_input_model_btn", "nj_currency_switcher"];
  const controls = [...header, ...toolbar];
  const hasControls = (items: Token[]): boolean => items.some((token) => token.type === "rule"
    ? controls.some((id) => new RegExp(`[#.]${id}\\b`).test(token.prelude)) || token.prelude.split(",").some((part) => /^button(?::(?:hover|focus|focus-visible|active))*$/.test(part.trim().replace(/:not\([^()]*\)/g, ""))) && !!modelControlChrome(token.body)
    : /^(media|supports)$/i.test(token.name) && hasControls(tokenize(token.body)));
  if (!hasControls(tokens)) return "";
  const root = `${scope} [data-source-presentation="mufy"]`;
  const selector = (id: string) => `${scope} ${`#${id}`.repeat(10)}`;
  const paintSelector = (id: string) => `${scope} ${`#${id}`.repeat(10)}`;
  const rules: string[] = [];
  const replayPaintState = (part: string): string | null => {
    const selector = part.trim();
    // A declaration from a rejected selector never painted replay in the first
    // place. Mirroring it would resurrect a filtered rule on sibling controls.
    if (!isSelectorAllowed(selector)) return null;
    const direct = selector.match(/[#.]nj_chat_input_replay_btn((?::(?:hover|focus|focus-visible|active))*)\s*$/);
    if (direct) return direct[1];
    // Legacy skins often paint all buttons but explicitly exclude the source
    // model label. That still paints replay and is the same family donor.
    // Do not infer from header-only/descendant selectors or replay exclusions.
    if (/:not\([^()]*nj_chat_input_replay_btn[^()]*\)/.test(selector)) return null;
    const bare = selector.replace(/:not\([^()]*\)/g, "");
    return bare.match(/^button((?::(?:hover|focus|focus-visible|active))*)$/)?.[1] ?? null;
  };
  // All character skins share the replay visual family. Older imports have no
  // provenance marker, so paint compatibility cannot depend on that marker.
  // Background-stage protections below remain source-only; legacy toolbar
  // labels/positioning need the same functional guard as new imports.
  const toolbarPaint = (items: Token[]): string => items.map((token): string => {
    if (token.type === "at-rule") {
      if (!/^(media|supports)$/i.test(token.name)) return "";
      const body = toolbarPaint(tokenize(token.body));
      return body ? `@${token.name} ${token.prelude} {\n${body}\n}` : "";
    }
    const targets = token.prelude.split(",").flatMap((part) => {
      const state = replayPaintState(part);
      return state !== null ? toolbar.slice(1).map((id) => `${paintSelector(id)}${state}`) : [];
    });
    if (!targets.length) return "";
    const chrome = modelControlChrome(sanitizeDeclarations(token.body, [], targets.join(", ")));
    const declarations = splitDeclarations(chrome).map((part) => `${part.trim().replace(/\s*!important\s*$/i, "")} !important`).join(";\n");
    return declarations ? targets.map((target) => `${target} {\n${declarations};\n}`).join("\n") : "";
  }).filter(Boolean).join("\n");
  const authoredControls = collectControlSkins(tokens);
  const hasReplayPaint = (items: Token[]): boolean => items.some((token) => token.type === "rule"
    ? token.prelude.split(",").some((part) => replayPaintState(part) !== null) && !!modelControlChrome(token.body)
    : /^(media|supports)$/i.test(token.name) && hasReplayPaint(tokenize(token.body)));
  const hasReplaySkin = hasReplayPaint(tokens);
  const hasGenericButtonPaint = (items: Token[]): boolean => items.some((token) => token.type === "rule"
    ? token.prelude.split(",").some((part) => /^button(?::(?:hover|focus|focus-visible|active))*$/.test(part.trim().replace(/:not\([^()]*\)/g, ""))) && !!modelControlChrome(token.body)
    : /^(media|supports)$/i.test(token.name) && hasGenericButtonPaint(tokenize(token.body)));
  const hasGenericSkin = hasGenericButtonPaint(tokens);
  if (hasReplaySkin || hasGenericSkin || authoredControls.has("nj_chat_input_model_btn")) {
    // Clear a model-only surface before replay paint is layered on top. This
    // also clears a leftover model border when replay only supplies a fill.
    // Without an authored replay donor, normalize the entire default family.
    // Replay's native gradient/currentColor defaults may otherwise differ from
    // the siblings' glass surface (observed on Fu Chiling).
    const targets = hasReplaySkin ? toolbar.slice(1) : toolbar;
    rules.push(`${targets.map(paintSelector).join(", ")} { background: var(--surface-glass) !important; border: 1px solid var(--border-subtle) !important; border-radius: var(--radius-sm) !important; box-shadow: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; color: var(--text-muted) !important; }`);
  }
  rules.push(toolbarPaint(tokens));
  // Preserve hidden compatibility anchors even if source CSS sets display:flex.
  rules.push(`${["nj_header_follow_btn", "nj_header_message_btn"].map((id) => `${paintSelector(id)}[aria-hidden="true"]`).join(", ")} { display: none !important; }`);
  // Low specificity for paint: an explicit authored container background wins.
  rules.push(`${root} :where(#nj_chat_header, #nj_chat_input_container) { background-color: transparent; border-color: transparent; }`);
  rules.push(`${controls.map(selector).join(", ")} {
    position: relative !important; inset: auto !important; transform: none !important;
    margin: 0 !important; float: none !important; box-sizing: border-box !important;
    align-items: center !important; justify-content: center !important;
    height: calc(var(--space-sm) * 5) !important; min-height: calc(var(--space-sm) * 5) !important;
    max-height: none !important; min-width: 0 !important; max-width: 100% !important;
    padding: var(--space-sm) !important; gap: var(--space-xs) !important;
    font-family: var(--font-body-zh) !important; font-size: var(--text-sm, 14px) !important;
    line-height: 1.25 !important; letter-spacing: normal !important;
    text-indent: 0 !important; white-space: nowrap !important;
  }`);
  rules.push(`${[...header, "nj_chat_input_replay_btn", "nj_mask_btn"].map(selector).join(", ")} { width: calc(var(--space-sm) * 5) !important; flex: 0 0 auto !important; }`);
  rules.push(`${["nj_chat_input_model_btn", "nj_currency_switcher"].map(selector).join(", ")} { width: auto !important; }`);
  const visit = (items: Token[]) => {
    for (const token of items) {
      if (token.type === "at-rule") {
        if (/^(media|supports)$/i.test(token.name)) visit(tokenize(token.body));
        continue;
      }
      const textReplacement = /(?:^|;)\s*content\s*:\s*(["'])[^"']+\1/i.test(token.body);
      const hidesText = /(?:^|;)\s*(?:color\s*:\s*transparent|font-size\s*:\s*0(?:px|rem|em)?(?:\s|;|!|$))/i.test(token.body);
      for (const id of controls) {
        // Only terminal control selectors; never touch descendant labels/cards.
        const target = new RegExp(`[#.]${id}\\b(?::(?:hover|focus|focus-visible|active|disabled))?(?:(::before|::after))?\\s*$`);
        for (const part of token.prelude.split(",")) {
          const match = part.trim().match(target);
          if (!match) continue;
          if (textReplacement && match[1]) {
            rules.push(`${selector(id)}${match[1]} { content: none !important; }`);
            // Source skins often hide the original icon when replacing its label.
            // Restore only the host's direct SVG, never message/card descendants.
            rules.push(`${selector(id)} > svg { display: block !important; visibility: visible !important; opacity: 1 !important; }`);
          }
          if (hidesText && !match[1]) {
            // Restoring a replay label also restores the family's currentColor
            // borders/icons. Otherwise the model retains the muted reset hue.
            const visibleLabels = id === "nj_chat_input_replay_btn" ? toolbar : [id];
            rules.push(`${visibleLabels.map(selector).join(", ")} { color: var(--text-primary) !important; }`);
          }
        }
      }
    }
  };
  visit(tokens);
  return rules.join("\n");
}

/**
 * Rewrite :root / html / body selectors to the scope root so CSS variables
 * defined in them can still work (via inheritance) without leaking globally.
 *
 * :root { --x: red }           → [data-character-css="id"] { --x: red }
 * html { --y: blue }           → [data-character-css="id"] { --y: blue }
 * body { font-size: 16px }     → [data-character-css="id"] { font-size: 16px }
 *
 * Special case: body background properties are redirected to #nj_background_image
 * to match the external → dearm migration contract (the source platform renders backgrounds on body,
 * dearm renders them on a dedicated layer).
 *
 * Returns null if the selector is blocked by isSelectorAllowed.
 * Returns { sel: string, isBareBody: boolean } where isBareBody signals that
 * the caller should split background properties to #nj_background_image.
 */
function rewriteRootSelector(
  sel: string,
  scopeSel: string,
): { sel: string; isBareBody: boolean } | null {
  const trimmed = sel.trim();
  const lower = trimmed.toLowerCase();

  // :root / html / body (bare, no descendants) → rewrite to scope root
  if (lower === ":root" || lower === "html") {
    return { sel: scopeSel, isBareBody: false };
  }
  if (lower === "body") {
    // Signal that caller should split background props to #nj_background_image
    return { sel: scopeSel, isBareBody: true };
  }

  // :root xxx / html xxx / body xxx (with descendants) → rewrite root part
  if (lower.startsWith(":root ") || lower.startsWith(":root>")) {
    return { sel: scopeSel + trimmed.slice(5), isBareBody: false };
  }
  if (lower.startsWith("html ") || lower.startsWith("html>")) {
    return { sel: scopeSel + trimmed.slice(4), isBareBody: false };
  }
  if (lower.startsWith("body ") || lower.startsWith("body>")) {
    return { sel: scopeSel + trimmed.slice(4), isBareBody: false };
  }

  // Not a root selector → check allow list
  if (!isSelectorAllowed(sel)) {
    return null;
  }

  // Allowed → add scope prefix
  return { sel: `${scopeSel} ${sel}`, isBareBody: false };
}

/**
 * 「跟随 replay 按钮」选择器镜像 —— 给已改写好的 safe 选择器里，凡含
 * `#nj_chat_input_replay_btn` 的，生成对应的 `#nj_mask_btn` / `#nj_currency_switcher`
 * 版本，让这两个寄情新增按钮跟着 replay 一起被创作者样式覆盖。
 *
 * 只处理**单纯针对 replay 的选择器**（replay 是选择器里唯一/最后的关键部分），
 * 用字符串替换把 id 换成新按钮 id。不动其它选择器。去重后返回新增的镜像选择器。
 */
const CONTROL_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  nj_chat_input_replay_btn: ["nj_mask_btn", "nj_currency_switcher", "nj_chat_input_model_btn"],
  nj_header_more_btn: ["nj_back_button", "nj_mobile_drawer_btn", "nj_review_btn", "nj_stage_adjust_btn"],
};

function mirrorSemanticControls(safeSelectors: string[], explicit: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const [donor, targets] of Object.entries(CONTROL_FAMILIES)) {
  for (const sel of safeSelectors) {
    const REPLAY = sel.match(new RegExp(`[#.]${donor}\\b`))?.[0];
    if (!REPLAY) continue;
    const suffix = sel.slice(sel.lastIndexOf(REPLAY) + REPLAY.length).trim();
    // Descendants and pseudo-elements carry replay-specific labels/icons. Mirroring
    // them produced repeated REWIND/重墨 text in Dearm's extra toolbar controls.
    if (
      suffix.includes("::") ||
      !/^(?:\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?)*$/.test(suffix)
    ) {
      continue;
    }
    for (const target of targets) {
      if (explicit.has(target)) continue;
      const mirrored = sel.split(REPLAY).join(`#${target}`);
      if (!safeSelectors.includes(mirrored) && !out.includes(mirrored)) {
        out.push(mirrored);
      }
    }
  }
  }
  return out;
}

function modelControlChrome(body: string, omitSemanticSvg = false): string {
  return splitDeclarations(body).filter((declaration) =>
    /^(?:background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow|backdrop-filter|-webkit-backdrop-filter|color)\s*:/i.test(declaration.trim()) &&
    !(omitSemanticSvg && /^background(?:-image)?\s*:/i.test(declaration.trim()) && /data:image\/svg\+xml/i.test(declaration)) &&
    !/^color\s*:\s*(?:transparent|rgba\([^)]*,\s*0\s*\))\s*(?:!important)?\s*$/i.test(declaration.trim()),
  ).map((s) => s.trim()).join(";\n  ");
}

/** Prefer the authored border hue to a neutral icon; never infer from imagery. */
function controlAccent(body: string): string | null {
  const declarations = splitDeclarations(body).map((part) => {
    const colon = part.indexOf(":");
    return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as const;
  });
  for (const [property, raw] of [...declarations].reverse()) {
    if (property !== "border-color" && property !== "border") continue;
    const value = raw.replace(/\s*!important\s*$/i, "");
    // Split only outside functions, preserving rgb(...) and nested var(...).
    const parts: string[] = [];
    let depth = 0;
    let token = "";
    for (const char of value) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (/\s/.test(char) && depth === 0) {
        if (token) parts.push(token);
        token = "";
      } else token += char;
    }
    if (token) parts.push(token);
    const colors = property === "border" ? parts.filter((part) =>
      !/^(?:none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset|thin|medium|thick|0|[\d.]+(?:px|rem|em))$/i.test(part),
    ) : parts;
    if (colors.length === 1 && !/^(?:transparent|inherit|initial|unset|revert)$/i.test(colors[0])) {
      return colors[0] + (/!important\s*$/i.test(raw) ? " !important" : "");
    }
  }
  return null;
}

function hasAuthoredMaskActiveSkin(tokens: Token[]): boolean {
  return tokens.some((token) => token.type === "rule"
    ? /[#.]nj_mask_btn\b[^,{]*\[(?:data-active|aria-pressed)/.test(token.prelude) && /(?:outline|box-shadow|border|background|color)\s*:/i.test(token.body)
    : /^(media|supports)$/i.test(token.name) && hasAuthoredMaskActiveSkin(tokenize(token.body)));
}

function collectControlSkins(tokens: Token[], result = new Set<string>()): Set<string> {
  const targets = Object.values(CONTROL_FAMILIES).flat();
  for (const token of tokens) {
    if (token.type === "rule" && modelControlChrome(token.body)) {
      for (const target of targets) {
        if (new RegExp(`[#.]${target}\\b`).test(token.prelude)) result.add(target);
      }
    } else if (token.type === "at-rule" && /^(media|supports)$/i.test(token.name)) {
      collectControlSkins(tokenize(token.body), result);
    }
  }
  return result;
}

/** Only copy the replay button's physical chrome, never its text/icon semantics. */
function sanitizeMirroredControlDeclarations(body: string): string {
  const allowed =
    /^(?:-webkit-backdrop-filter|appearance|backdrop-filter|background(?:-.+)?|border(?:-.+)?|box-shadow|filter|height|max-height|max-width|min-height|min-width|opacity|outline(?:-.+)?|padding(?:-.+)?|margin(?:-.+)?|transform(?:-.+)?|transition(?:-.+)?|width)$/;
  const out: string[] = [];
  for (const raw of splitDeclarations(body)) {
    const trimmed = raw.trim();
    const colon = trimmed.indexOf(":");
    if (colon < 1) continue;
    const prop = trimmed.slice(0, colon).trim().toLowerCase();
    if (allowed.test(prop)) out.push(trimmed);
  }
  return out.join(";\n  ");
}

function isSelectorAllowed(sel: string): boolean {
  const head = sel.split(/[\s>+~]/, 1)[0];
  // strip pseudo / attribute / id selectors to get the base
  const base = head.replace(/[:.[#].*$/, "");

  // ---- 危险目标黑名单（永远禁，无论 scope 在不在）----
  // 这几类选择器会逃出 [data-character-css="<id>"] scope，影响 dearm 全局 chrome。
  if (base === "*") return false;

  // 禁 self-reference：作者写 [data-character-css="..."] 会逃出 scope。
  if (/data-character-css/i.test(head)) return false;

  // 注：#nj_chat_input_box 现在指向输入框「外框」wrapper（对齐契约与外部结构），
  // 创作者理应能给它加背景/边框做主题化，故**放行**（不再拉黑）。当年拉黑是因为
  // 那时 id 错放在 textarea 上，创作者加 border 会和外框 border 叠成双层框；现在
  // id 归位到外框、内层 textarea 默认 border-0，双层框不再可能。见
  // docs/exec-plans/active/input-box-skin.md。property 级安全过滤（position:fixed
  // / pointer-events / z-index>100）在下方 sanitizeDeclarations 仍全部生效。

  // ---- nj_* 永远允许（dearm 自家公开选择器约定）----
  if (/nj_/.test(head)) return true;

  // ---- 放宽白名单：class / id / attr / pseudo-class 头 ----
  // 之前严格只放 nj_*，导致外部导入卡用作者自己命名（cyd-*/cyi-*/cen-*/
  // censy_*/Tailwind 工具类）的 CSS 全军覆没 —— 25KB 的 globalCss 几乎被
  // 过滤光。放宽到「scope + 黑名单」就够安全：scopeSel 把每条规则都钉在
  // [data-character-css="<id>"] 子树内，不会泄漏到平台 chrome。
  if (head.startsWith(".")) return true;
  if (head.startsWith("#")) return true;
  if (head.startsWith("[")) return true;
  // bare pseudo-class（`:hover` / `:focus` 等）也允许 —— scope 兜底约束范围。
  // `:root` 已在前面黑名单单独处理。
  if (head.startsWith(":")) return true;

  // ---- bare tag 选择器：只允许 safe-tag list（仍然禁 div/span/p 等 chrome 元素）----
  const lower = sel.toLowerCase();
  const lowerBase = base.toLowerCase();

  for (const prefix of SAFE_TAG_PREFIXES) {
    if (lower.startsWith(prefix)) return true;
  }

  // 裸的 details 选择器会导致双层框问题：全局CSS给 .nj_ai_message_bubble 加边框，
  // 同时也给内部的 <details> 加边框，造成大框套小框。只允许带限定符的 details：
  //   ✓ .status-wrapper details  (后代选择器)
  //   ✓ details.m-box            (带class)
  //   ✓ details[open]            (带attribute)
  //   ✗ details                  (裸标签)
  if (lowerBase === "details") {
    // 如果 base 是 details，检查是否有修饰符（class/id/attr/pseudo）
    // head 是去除后代选择器后的第一部分，如果 head !== base 说明有修饰符
    return head !== base;
  }

  if (
    [
      "summary",
      "pre",
      "code",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "blockquote",
    ].includes(lowerBase)
  )
    return true;

  return false;
}

/**
 * 按 `;` 切声明，但跳过 quote / paren 内部的 `;` —— 因为 CSS 值里允许
 * 内嵌分号（最典型场景：data URL）：
 *
 *   -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3csvg...") no-repeat;
 *
 * 朴素 split(";") 会把这一条声明在 url() 内部劈成两半，sanitize 重新拼接
 * 时插入 `;\n  ` 把裸 newline 塞进 CSS 字符串字面量内，浏览器 parser 撞
 * 见无效字符串就放弃当前 stylesheet 后续所有规则（observed 在李逾寻 25KB
 * globalCss 上，160 条规则只活下来 47 条）。
 */
function splitDeclarations(body: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuote: '"' | "'" | null = null;
  let parenDepth = 0;
  for (const ch of body) {
    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
    } else if (ch === "(") {
      parenDepth++;
      current += ch;
    } else if (ch === ")") {
      if (parenDepth > 0) parenDepth--;
      current += ch;
    } else if (ch === ";" && parenDepth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out;
}

/** A broken value must not consume subsequent rules or our host safeguards.
 * Drop only that declaration; do not invent missing author values. */
function isBalancedDeclaration(prop: string, value: string): boolean {
  if (!/^(?:--?)?[a-z_][\w-]*$/i.test(prop)) return false;
  const stack: string[] = [];
  let quote = "";
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "\\") { i++; continue; }
    if (quote) {
      if (c === quote) quote = "";
      else if (c === "\n" || c === "\r") return false;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(") stack.push(")");
    else if (c === "[") stack.push("]");
    else if (c === ")" || c === "]") { if (stack.pop() !== c) return false; }
    else if (c === "{" || c === "}") return false;
  }
  return !quote && stack.length === 0;
}

/**
 * Split a CSS declaration block into background-related properties and other properties.
 * Used for body { ... } rules to redirect backgrounds to #nj_background_image while
 * keeping other properties on the scope root.
 *
 * Background properties (redirected to #nj_background_image):
 *   - background, background-image, background-color, background-size, background-position,
 *     background-repeat, background-attachment, background-clip, background-origin
 *
 * Returns { background: string, other: string } — both sanitized and ready to emit.
 */
function splitBackgroundProperties(
  body: string,
  warnings: string[],
): { background: string; other: string } {
  const decls = splitDeclarations(body);
  const backgroundDecls: string[] = [];
  const otherDecls: string[] = [];

  for (const raw of decls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const prop = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();

    if (!isBalancedDeclaration(prop, value)) {
      warnings.push(`malformed declaration dropped: ${prop}`);
      continue;
    }

    // Check if this is a background property
    const isBackground =
      prop === "background" ||
      prop.startsWith("background-") ||
      prop === "-webkit-mask" ||
      prop === "mask" ||
      prop.startsWith("-webkit-mask-") ||
      prop.startsWith("mask-");

    // Apply the same security checks as sanitizeDeclarations
    let blocked = false;

    if (prop === "position") {
      const v = value.replace(/\s*!important\s*$/i, "").trim();
      if (v === "fixed" || v === "sticky") {
        warnings.push("position: fixed/sticky blocked");
        blocked = true;
      }
    } else if (prop === "pointer-events") {
      warnings.push("pointer-events not allowed");
      blocked = true;
    } else if (prop === "cursor" && /\bnone\b/i.test(value)) {
      warnings.push("cursor: none blocked");
      blocked = true;
    } else if (prop === "z-index") {
      const n = Number.parseInt(value, 10);
      if (!Number.isNaN(n) && n > 100) {
        warnings.push("z-index > 100 blocked");
        if (isBackground) {
          backgroundDecls.push(`${prop}: 100`);
        } else {
          otherDecls.push(`${prop}: 100`);
        }
        continue;
      }
    }

    if (/expression\s*\(/i.test(value)) {
      warnings.push("expression() blocked");
      blocked = true;
    }
    if (/url\s*\(\s*['"]?javascript:/i.test(value)) {
      warnings.push("javascript: url blocked");
      blocked = true;
    }

    if (!blocked) {
      if (isBackground) {
        backgroundDecls.push(`${prop}: ${value}`);
      } else {
        otherDecls.push(`${prop}: ${value}`);
      }
    }
  }

  return {
    background: backgroundDecls.join(";\n  "),
    other: otherDecls.join(";\n  "),
  };
}

function sanitizeDeclarations(
  body: string,
  warnings: string[],
  selector?: string,
): string {
  const decls = splitDeclarations(body);
  const out: string[] = [];
  for (const raw of decls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const prop = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();

    if (!isBalancedDeclaration(prop, value)) {
      warnings.push(`malformed declaration dropped: ${prop}`);
      continue;
    }

    if (prop === "position") {
      const v = value.replace(/\s*!important\s*$/i, "").trim();
      if (v === "fixed" || v === "sticky") {
        warnings.push("position: fixed/sticky blocked");
        continue;
      }
      out.push(`${prop}: ${value}`);
      continue;
    }
    if (prop === "pointer-events") {
      warnings.push("pointer-events not allowed");
      continue;
    }
    if (prop === "cursor" && /\bnone\b/i.test(value)) {
      warnings.push("cursor: none blocked");
      continue;
    }
    // 拦截过于宽泛选择器的 display: none —— 避免隐藏平台图标
    if (prop === "display" && /\bnone\b/i.test(value)) {
      const sel = (selector || "").toLowerCase();
      // 只允许有明确 nj_ 或 mufy_ 前缀的选择器使用 display: none
      if (!sel.includes("nj_") && !sel.includes("mufy_")) {
        warnings.push(
          `display: none blocked for overly broad selector: ${selector || "unknown"}`,
        );
        continue;
      }
    }
    if (prop === "z-index") {
      const n = Number.parseInt(value, 10);
      if (!Number.isNaN(n) && n > 100) {
        warnings.push("z-index > 100 blocked");
        out.push(`${prop}: 100`);
        continue;
      }
    }
    if (FORBIDDEN_PROPERTIES.has(prop)) {
      // Already handled the special cases above; anything left is allowed.
    }

    // Block expression() (IE legacy), javascript: in url(), bare http:// urls
    if (/expression\s*\(/i.test(value)) {
      warnings.push("expression() blocked");
      continue;
    }
    if (/url\s*\(\s*['"]?javascript:/i.test(value)) {
      warnings.push("javascript: url blocked");
      continue;
    }

    out.push(`${prop}: ${value}`);
  }
  return out.join(";\n  ");
}

// Minimal token walker. Splits the input into rule / at-rule blocks at the
// outer level. Comments and @import are already stripped before calling.
type Token =
  | { type: "rule"; prelude: string; body: string }
  | { type: "at-rule"; name: string; prelude: string; body: string };

function tokenize(css: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    // skip whitespace
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;
    if (css[i] === "@") {
      const start = i + 1;
      // parse rule name + prelude up to `{` or `;`
      let j = start;
      while (j < n && css[j] !== "{" && css[j] !== ";") j++;
      const head = css.slice(start, j).trim();
      // Whitespace is optional before a condition: @media(max-width:600px).
      const atHead = head.match(/^([\w-]+)([\s\S]*)$/);
      const name = atHead?.[1] ?? head;
      const prelude = atHead?.[2].trim() ?? "";
      if (css[j] === ";") {
        // bodyless @-rule, skipping
        i = j + 1;
        continue;
      }
      const { body, end } = readBlock(css, j);
      tokens.push({ type: "at-rule", name, prelude, body });
      i = end;
    } else {
      const start = i;
      while (i < n && css[i] !== "{") i++;
      if (i >= n) break;
      const prelude = css.slice(start, i).trim();
      const { body, end } = readBlock(css, i);
      tokens.push({ type: "rule", prelude, body });
      i = end;
    }
  }
  return tokens;
}

function readBlock(
  css: string,
  openBracePos: number,
): { body: string; end: number } {
  let depth = 0;
  let i = openBracePos;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = css.slice(openBracePos + 1, i);
  return { body, end: i + 1 };
}
