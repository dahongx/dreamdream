/**
 * DOMPurify wrapper — single import surface for both server (RSC) and
 * client. Pinned config so creator-authored HTML can't slip through a
 * dangerous tag/attribute.
 *
 * Semantic tag allowlist (host-routed via react-markdown components map,
 * see docs/contracts/chat-render-spec.md §2.3): message/mes, narration/nar,
 * system/sys, scenario/sce, think, artifact, user/usr. These must survive
 * sanitize so rehype-raw can hand them to the components map. Browsers
 * treat unknown tags as inert containers; the actual rendering is in
 * React.
 */

import DOMPurify from "isomorphic-dompurify";

const SEMANTIC_TAGS = [
  "message",
  "mes",
  "narration",
  "nar",
  "system",
  "sys",
  "scenario",
  "sce",
  "think",
  "artifact",
  "user",
  "usr",
] as const;

export interface SanitizeOptions {
  /** Allow <style> blocks (true for chat messages, false for embed snippets). */
  allowStyle?: boolean;
}

export function sanitizeHtml(
  input: string,
  opts: SanitizeOptions = {},
): string {
  const { allowStyle = true } = opts;

  const config: Parameters<typeof DOMPurify.sanitize>[1] = {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
    ],
    FORBID_ATTR: ["formaction", "srcdoc"],
    ADD_TAGS: [...SEMANTIC_TAGS, ...(allowStyle ? ["style"] : [])],
    ADD_ATTR: ["target", "rel", "class", "style", "data-*"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  };

  const out = DOMPurify.sanitize(input, config) as unknown;
  return typeof out === "string" ? out : String(out);
}
