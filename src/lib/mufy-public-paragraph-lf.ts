/** Preserve observed author paragraph line breaks only in Mufy source-rendering mode. */
import { sanitizeHtml } from "@/lib/sanitize";
export interface MufyParagraphLfEnvelope {
  source: string;
  token: string | null;
  protectedCount: number;
}

const HTML_PARTS =
  /<!--[\s\S]*?-->|<(?:(?:"[^"]*")|(?:'[^']*')|[^'">])*>|[^<]+|</g;
const SOURCE_PARAGRAPH_CLASS = /\bclass\s*=\s*(["'])(.*?)\1/i;

/** Only explicit, observed Mufy paragraph markup is eligible. Native Dearm is an exact no-op. */
export function protectMufyPublicParagraphLf(
  source: string,
  mufySourceDefaults = false,
): MufyParagraphLfEnvelope {
  if (!mufySourceDefaults) return { source, token: null, protectedCount: 0 };
  // Cheap no-op path runs before DOMPurify: most streamed segments have no eligible HTML LF.
  if (!source.includes("\n") || !/<p\b/i.test(source))
    return { source, token: null, protectedCount: 0 };
  const positions: number[] = [];
  let eligibleParagraph = false;
  let rawTag: string | null = null;
  for (const item of source.matchAll(HTML_PARTS)) {
    const part = item[0];
    if (part === "<") break; // An incomplete streamed tag/attribute is not paragraph text.
    if (part.startsWith("<!--")) continue;
    if (part.startsWith("<")) {
      const match = /^<\s*(\/?)\s*([\w-]+)/.exec(part);
      if (!match) continue;
      const [, close, rawName] = match;
      const name = rawName.toLowerCase();
      if (rawTag) {
        if (close && name === rawTag) rawTag = null;
        continue;
      }
      if (
        !close &&
        ["pre", "code", "style", "script", "textarea"].includes(name)
      )
        rawTag = name;
      if (name === "p") {
        if (close) eligibleParagraph = false;
        else {
          const classes =
            SOURCE_PARAGRAPH_CLASS.exec(part)?.[2].split(/\s+/) ?? [];
          eligibleParagraph =
            classes.includes("leading-5") && classes.includes("text-white");
        }
      }
      continue;
    }
    if (!eligibleParagraph || rawTag) continue;
    for (let i = 0; i < part.length; i++)
      if (part[i] === "\n") positions.push(item.index + i);
  }
  if (!positions.length) return { source, token: null, protectedCount: 0 };
  // Check decoded HTML too: a token encoded as character references must not be rewritten.
  const decodedCollisionSource = sanitizeHtml(source);
  let serial = 0;
  let token: string;
  do {
    token = `\uE000MUFY_PUBLIC_LF_${serial++}\uE001`;
  } while (source.includes(token) || decodedCollisionSource.includes(token));
  const parts: string[] = [];
  let cursor = 0;
  for (const position of positions) {
    parts.push(source.slice(cursor, position), token);
    cursor = position + 1;
  }
  parts.push(source.slice(cursor));
  return { source: parts.join(""), token, protectedCount: positions.length };
}

interface TextTree {
  type?: string;
  value?: string;
  children?: TextTree[];
}

/** Install AFTER rehypeRaw, before React rendering. Restored LF is ordinary text: no copy marker remains. */
export function rehypeRestoreMufyPublicParagraphLf(token: string | null) {
  return () => (tree: TextTree) => {
    if (!token) return;
    const marker = token;
    function restore(node: TextTree): void {
      if (node.type === "text" && typeof node.value === "string")
        node.value = node.value.split(marker).join("\n");
      for (const child of node.children ?? []) restore(child);
    }
    restore(tree);
  };
}
