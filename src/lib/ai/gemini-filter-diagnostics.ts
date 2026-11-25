export interface GeminiSafetyRatingDiagnostic {
  category: string | null;
  probability: string | null;
  probabilityScore: number | null;
  severity: string | null;
  severityScore: number | null;
  blocked: boolean | null;
}

export interface GeminiFilterDiagnostics {
  rawFinishReason: string | null;
  finishMessage: string | null;
  safetyRatings: GeminiSafetyRatingDiagnostic[];
}

const MAX_FINISH_MESSAGE_LENGTH = 500;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function findGoogleMetadata(
  providerMetadata: unknown,
): Record<string, unknown> | null {
  const root = asRecord(providerMetadata);
  if (!root) return null;

  const candidates = [
    root.google,
    root["google.generative-ai"],
    ...Object.values(root),
  ];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record && ("safetyRatings" in record || "finishMessage" in record)) {
      return record;
    }
  }
  return null;
}

/**
 * Retain only provider filter diagnostics. Prompt and generated content are
 * deliberately excluded so production logs never gain another content sink.
 */
export function extractGeminiFilterDiagnostics(
  rawFinishReason: unknown,
  providerMetadata: unknown,
): GeminiFilterDiagnostics {
  const google = findGoogleMetadata(providerMetadata);
  const rawRatings = Array.isArray(google?.safetyRatings)
    ? google.safetyRatings
    : [];
  const safetyRatings = rawRatings.flatMap((value) => {
    const rating = asRecord(value);
    if (!rating) return [];
    return [
      {
        category: nullableString(rating.category),
        probability: nullableString(rating.probability),
        probabilityScore: nullableNumber(rating.probabilityScore),
        severity: nullableString(rating.severity),
        severityScore: nullableNumber(rating.severityScore),
        blocked: nullableBoolean(rating.blocked),
      },
    ];
  });
  const finishMessage = nullableString(google?.finishMessage);

  return {
    rawFinishReason: nullableString(rawFinishReason),
    finishMessage: finishMessage
      ? finishMessage
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, MAX_FINISH_MESSAGE_LENGTH)
      : null,
    safetyRatings,
  };
}
