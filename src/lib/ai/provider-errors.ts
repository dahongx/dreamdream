/** Return true only for provider-side rejection of the submitted prompt. */
export function isPromptPolicyRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  let serialized = "";
  try {
    serialized = JSON.stringify(error);
  } catch {
    // Some SDK errors contain circular request/response objects.
  }
  const detail = `${message}\n${serialized}`.toLowerCase();
  return (
    detail.includes("prompt contains sensitive words") ||
    detail.includes("generative ai prohibited use policy") ||
    detail.includes("prompt was blocked for safety") ||
    detail.includes("prompt_blocked")
  );
}
