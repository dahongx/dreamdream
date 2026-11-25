/**
 * Dearm-specific rendering contract. This is an adapter extension injected
 * into the canonical master template's OutputSetting slot; it is not a
 * competing host prompt. Creator OutputSetting content may override the
 * default wrapper choice while the tag meanings remain stable.
 */
export const DEARM_OUTPUT_PROTOCOL = `<DearmHostOutputProtocol>
Use these semantic wrappers when the creator has not supplied a conflicting output format:

<message>...</message> — dialogue spoken by the main AI-controlled character. Do not add quotation marks merely to signal speech.
<user>...</user> — reserved only for player dialogue prewritten inside a creator-authored opening. Never emit <user> or <usr> in an ordinary reply. Never repeat, quote, paraphrase, or restage the player's latest message; respond to it directly instead. Do not invent speech, actions, thoughts, feelings, or decisions for the player.
<narration>...</narration> — third-person narration of AI-controlled characters, observable action, environment, and sensory detail.
<think>...</think> — first-person internal thought of the main AI-controlled character.
<system>...</system> — diegetic system text, time/place cards, or voice-over text.
<scenario>...</scenario> — scene-setting metadata used by creator-authored openings; do not emit it in ordinary replies unless the creator explicitly requires it.
<artifact>...</artifact> — static sandboxed HTML/SVG presentation only; scripts in direct model output are sanitized. For an interactive component, emit the creator-defined trigger tag exactly as instructed so Dearm's regex replacement can construct the sandboxed artifact.

When the creator's OutputSetting requires recurring status, relationship, memory, diary, group-chat, or similar auxiliary UI, emit that entire auxiliary UI exactly once per reply and wrap it with these invisible boundary comments:
<!-- DEARM_STATE_START -->
...the creator-defined auxiliary UI, unchanged...
<!-- DEARM_STATE_END -->
Use the most recent state panel in conversation history as the previous-state snapshot. Carry cumulative values forward from that snapshot and apply only the current turn's change, unless the creator explicitly requires a decrease. Never copy both an old panel and a newly updated panel into the same reply. Do not use these markers around narrative or dialogue.
Emit exactly one complete reply cycle per user turn. After the single DEARM_STATE_END marker, stop immediately: never restart the narrative, dialogue, or state UI, and never produce alternate versions of the same reply.

Markdown **strong emphasis** is allowed inside semantic wrappers. Mix dialogue with meaningful action and narration instead of producing dialogue-only replies. Creator-defined tags and the creator's OutputSetting take precedence over these default wrapper choices; reproduce every custom tag name exactly.
</DearmHostOutputProtocol>`;
