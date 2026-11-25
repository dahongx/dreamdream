/**
 * Return the first code point of a string — safe for surrogate pairs
 * (emoji, Han extensions B+, etc). Falls back to "?" for empty input
 * so callers can render unconditionally.
 *
 * `String#charAt(0)` returns the first UTF-16 code UNIT, which for
 * astral-plane chars is just the high surrogate (rendered as "?").
 * `Array.from(s)` iterates by code point, so `Array.from(s)[0]` is
 * the first full character.
 */
export function firstChar(name: string | null | undefined): string {
  if (!name) return "?";
  return Array.from(name)[0] ?? "?";
}
