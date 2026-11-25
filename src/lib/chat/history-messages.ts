import { isExplicitModelRefusal } from "@/lib/ai/response-refusal";

interface HistoryMessageLike {
  role: string;
  parts: readonly unknown[];
  metadata?: unknown;
}

function isSafetyBlockedMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as { safetyBlocked?: unknown }).safetyBlocked === true;
}

function isStoppedByUserMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as { stoppedByUser?: unknown }).stoppedByUser === true;
}

function hasVisibleText(parts: readonly unknown[]): boolean {
  return parts.some(
    (part) =>
      part !== null &&
      typeof part === "object" &&
      !Array.isArray(part) &&
      (part as { type?: unknown }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string" &&
      (part as { text: string }).text.trim().length > 0,
  );
}

/**
 * Keep visible safety-truncated assistant replies in model history.
 *
 * Dropping a visible reply turns user -> assistant -> user into two adjacent
 * user turns. Providers merge adjacent user turns, so the next response
 * answers both prompts and appears to repeat the previous scene. An empty
 * safety placeholder carries no context and remains safe to discard.
 */
export function prepareChatHistory<T extends HistoryMessageLike>(
  messages: readonly T[],
): T[] {
  return messages
    .filter(
      (message) =>
        message.role !== "assistant" ||
        !isSafetyBlockedMetadata(message.metadata) ||
        hasVisibleText(message.parts),
    )
    .map((message) => {
      const text = message.parts
        .flatMap((part) => {
          if (!part || typeof part !== "object") return [];
          const value = part as { type?: unknown; text?: unknown };
          return value.type === "text" && typeof value.text === "string"
            ? [value.text]
            : [];
        })
        .join("");
      if (message.role === "assistant" && isExplicitModelRefusal(text)) {
        // Preserve turn order without teaching subsequent replies to imitate a refusal.
        return {
          ...message,
          parts: [
            {
              type: "text",
              text: "[The previous assistant request was not completed.]",
            },
          ],
        } as T;
      }
      if (
        message.role !== "assistant" ||
        !isStoppedByUserMetadata(message.metadata)
      ) {
        return message;
      }

      // Keep the assistant turn so role alternation remains intact, but do not
      // feed a deliberately rejected partial reply back to the model.  Doing so
      // makes the next turn echo the exact prose the player just stopped.
      return {
        ...message,
        parts: [
          {
            type: "text",
            text: "[The player stopped the previous assistant generation. Do not continue or imitate that rejected draft.]",
          },
        ],
      } as T;
    });
}
