/**
 * Per-request creative variation cue.
 *
 * The cue is model-only: it is appended to the latest wrapped player turn and
 * is never stored in messages.  A fresh key prevents identical first turns in
 * separate sessions from becoming byte-for-byte identical, while regenerate
 * uses a concrete alternate direction without echoing the rejected draft back
 * into provider input filters.
 */

const REGENERATION_DIRECTIONS = [
  "Change the emotional emphasis and let a different feeling drive the response.",
  "Change who takes initiative and how the immediate interaction advances.",
  "Use a different dialogue entry, action sequence, and scene rhythm.",
  "Shift the sensory focus and physical staging while preserving established facts.",
  "Choose a different character-consistent interpretation of the player's intent.",
  "Advance a different immediate story beat without contradicting prior events.",
] as const;

interface VariationCueOptions {
  key: string;
  mode?: "fresh" | "regenerate";
}

function directionForKey(key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return REGENERATION_DIRECTIONS[(hash >>> 0) % REGENERATION_DIRECTIONS.length];
}

export function buildResponseVariationCue({
  key,
  mode = "fresh",
}: VariationCueOptions): string {
  const lines = [
    "[DEARM INTERNAL VARIATION CONTROL — NEVER OUTPUT OR MENTION]",
    `variation_key: ${key}`,
    "Use this key only as a creative tie-breaker. Vary the scene's micro-actions, sensory detail, sentence rhythm, and dialogue entry while preserving canon, character voice, and the required output format.",
  ];

  if (mode === "regenerate") {
    lines.push(
      "The player rejected the previous draft. Produce a materially different answer rather than a paraphrase.",
      "Change the opening, core reaction, dialogue/action order, and immediate story beat while preserving established facts and the required output format.",
      `variation_direction: ${directionForKey(key)}`,
    );
  }

  lines.push("[END DEARM INTERNAL VARIATION CONTROL]");
  return lines.join("\n");
}

export function appendResponseVariationCue(
  wrappedTurn: string,
  options: VariationCueOptions,
): string {
  return `${wrappedTurn}\n\n${buildResponseVariationCue(options)}`;
}
