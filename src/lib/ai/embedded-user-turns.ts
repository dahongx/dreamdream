/**
 * `<user>` / `<usr>` inside an assistant reply represents the player speaking.
 * That is useful in a creator-authored opening, but an ordinary reply already
 * follows a real user message. Re-emitting it duplicates the player's bubble.
 *
 * The unterminated form is removed as well so streaming never flashes a large
 * temporary player bubble while the closing tag is still being generated.
 */
const COMPLETE_EMBEDDED_USER_RE =
  /[ \t]*<(user|usr)\b[^>]*>[\s\S]*?<\/\1\s*>[ \t]*(?:\r?\n)?/gi;
const STREAMING_EMBEDDED_USER_RE = /[ \t]*<(user|usr)\b[^>]*>[\s\S]*$/i;

export function stripEmbeddedUserTurns(text: string): string {
  if (!/<(?:user|usr)\b/i.test(text)) return text;

  return text
    .replace(COMPLETE_EMBEDDED_USER_RE, "")
    .replace(STREAMING_EMBEDDED_USER_RE, "")
    .replace(/\n{3,}/g, "\n\n");
}
