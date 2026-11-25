/**
 * Replacement envelope normalization for externally imported rules.
 *
 * The source platform uses a markdown code fence (```html ... ```) as its iframe envelope.
 * 寄情 routes to <RegexIframe> only when the replacement is a single
 * <artifact>...</artifact> envelope (see ARTIFACT_ENVELOPE_RE in segments.ts).
 *
 * Creators frequently paste fenced replacements straight from that platform, which
 * then fall into the sanitize path and have their <script>/<style> stripped.
 * normalizeReplacementEnvelope detects the fence-only case and rewrites it
 * to the platform's artifact envelope. All other shapes pass through
 * unchanged so we never rewrap content that was deliberately not iframe-routed.
 */

const FENCE_ENVELOPE_RE =
  /^\s*```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n\s*```\s*$/;

const ARTIFACT_ENVELOPE_RE = /^\s*<artifact>[\s\S]*<\/artifact>\s*$/i;

export function normalizeReplacementEnvelope(replacement: string): string {
  if (ARTIFACT_ENVELOPE_RE.test(replacement)) return replacement;

  const fence = FENCE_ENVELOPE_RE.exec(replacement);
  if (!fence) return replacement;

  const inner = fence[1];
  if (inner.includes("```")) return replacement;

  return `<artifact>${inner}</artifact>`;
}
