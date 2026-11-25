type LatestActiveMessage = {
  id: string;
  role: "user" | "assistant";
};

/** Only the request whose user row is still the session tail may persist. */
export function isOriginatingTurnCurrent(
  originatingUserMessageId: string | null,
  latestActiveMessage: LatestActiveMessage | undefined,
): boolean {
  return (
    originatingUserMessageId !== null &&
    latestActiveMessage?.role === "user" &&
    latestActiveMessage.id === originatingUserMessageId
  );
}

/**
 * Regeneration keeps the rejected assistant row active until its replacement
 * is ready. Only that exact row may still be the session tail when the new
 * reply lands; a delete, fork, or newer turn makes the request stale.
 */
export function isRegenerationTargetCurrent(
  targetAssistantMessageId: string | null,
  latestActiveMessage: LatestActiveMessage | undefined,
): boolean {
  return (
    targetAssistantMessageId !== null &&
    latestActiveMessage?.role === "assistant" &&
    latestActiveMessage.id === targetAssistantMessageId
  );
}

/**
 * Fresh sends insert a user row before streaming. If streaming errors before
 * the assistant row lands, that user row stays as the session tail and the
 * in-flight guard (see route.ts CHAT_IN_FLIGHT_TTL_MS) 409s every subsequent
 * send in the same session for the entire TTL — even when the user switches
 * to a different model. Superseding the orphan on the error path releases
 * the guard immediately. Regenerate turns operate on a pre-existing user row
 * we did not just insert, so they must never be superseded.
 */
export function shouldSupersedeOriginatingUser(
  isRegenerate: boolean,
  originatingUserMessageId: string | null,
): boolean {
  return !isRegenerate && originatingUserMessageId !== null;
}
