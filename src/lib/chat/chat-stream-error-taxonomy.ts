/** Finite diagnostics only. Never return or stringify any property of the input. */
export type ChatStreamErrorTaxonomy =
  | "json-parse"
  | "schema"
  | "protocol-sequence"
  | "transport"
  | "aborted"
  | "server-reported"
  | "unknown";

export function classifyChatStreamError(
  error: unknown,
): ChatStreamErrorTaxonomy {
  try {
    if (!error || (typeof error !== "object" && typeof error !== "function"))
      return "unknown";
    // Installed SDK definitions: provider/json-parse-error, type-validation-error,
    // ai/error/ui-message-stream-error. No nested cause, data, stack or body reads.
    const name: unknown = Reflect.get(error, "name");
    if (name === "AI_JSONParseError") return "json-parse";
    if (name === "AI_TypeValidationError") return "schema";
    if (name === "AI_UIMessageStreamError") return "protocol-sequence";
    if (name === "AbortError") return "aborted";
    if (name !== "TypeError" && name !== "Error") return "unknown";
    const marker: unknown = Reflect.get(error, "message");
    // Exact known browser transport markers, narrower than SDK fetch/network
    // substring heuristic. TypeError alone is intentionally unknown.
    if (
      name === "TypeError" &&
      (marker === "Failed to fetch" ||
        marker === "NetworkError when attempting to fetch resource." ||
        marker === "Load failed")
    )
      return "transport";
    // Static error events emitted by the current /api/chat route, not arbitrary
    // server HTTP body text. This classification does not prove the root cause.
    if (
      name === "Error" &&
      (marker === "stream_error" ||
        marker === "model_unavailable" ||
        marker === "content_restricted")
    )
      return "server-reported";
    return "unknown";
  } catch {
    // Accessors and proxies must not break the existing error alert.
    return "unknown";
  }
}

export function chatStreamErrorDiagnosticAttribute(
  error: unknown,
  canDebug: boolean,
  hasVisibleErrorAlert: boolean,
): ChatStreamErrorTaxonomy | undefined {
  if (!canDebug || !hasVisibleErrorAlert) return undefined;
  return classifyChatStreamError(error);
}
