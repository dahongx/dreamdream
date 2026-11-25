/** Serialization integrity only. Passing never proves runtime/UI completeness. */
export interface MufyPublicCaptureIntegrityFields {
  greeting: string;
  componentMarkup?: string;
  documents: string[];
  styles: string[];
  capturedLengths?: {
    greeting?: number;
    componentMarkup?: number;
    documents?: number[];
    styles?: number[];
  };
  elapsedMs?: number;
}

function fail(code: string, path: string): never {
  // Never include captured HTML, CSS, author text or invalid supplied values.
  throw new Error(`MUFY_PUBLIC_CAPTURE_${code}:${path}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_OBJECT", path);
  }
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") fail("INVALID_STRING", path);
  if (/\[Truncated\]\s*$/u.test(value)) fail("TRUNCATED", path);
}

function stringsAt(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value)) fail("INVALID_ARRAY", path);
  // Index explicitly so sparse arrays cannot silently skip a missing string.
  for (let index = 0; index < value.length; index++) {
    stringAt(value[index], `${path}[${index}]`);
  }
}

function lengthAt(expected: unknown, actual: number, path: string): void {
  if (
    typeof expected !== "number" ||
    !Number.isSafeInteger(expected) ||
    expected < 0
  ) {
    fail("INVALID_LENGTH", path);
  }
  if (expected !== actual) fail("LENGTH_MISMATCH", path);
}

function lengthsAt(expected: unknown, actual: string[], path: string): void {
  if (!Array.isArray(expected)) fail("INVALID_ARRAY", path);
  lengthAt(expected.length, actual.length, `${path}.length`);
  for (let index = 0; index < actual.length; index++) {
    lengthAt(expected[index], actual[index].length, `${path}[${index}]`);
  }
}

/**
 * Validate before preparing/importing a public capture. Lengths use JavaScript
 * UTF-16 string.length, not UTF-8 bytes or Unicode code-point counts.
 *
 * Empty document strings and unreadable/cross-origin frame metadata are allowed:
 * browser evidence must separately establish loading, purpose and actual UI.
 */
export function assertMufyPublicCaptureIntegrity(
  capture: unknown,
): asserts capture is MufyPublicCaptureIntegrityFields {
  const value = objectAt(capture, "capture");
  stringAt(value.greeting, "greeting");
  if (value.componentMarkup !== undefined)
    stringAt(value.componentMarkup, "componentMarkup");
  stringsAt(value.documents, "documents");
  stringsAt(value.styles, "styles");

  if (
    value.elapsedMs !== undefined &&
    (typeof value.elapsedMs !== "number" ||
      !Number.isFinite(value.elapsedMs) ||
      value.elapsedMs <= 0)
  )
    fail("INVALID_ELAPSED_MS", "elapsedMs");

  if (value.capturedLengths === undefined) return;
  const lengths = objectAt(value.capturedLengths, "capturedLengths");
  if (lengths.greeting !== undefined) {
    lengthAt(
      lengths.greeting,
      value.greeting.length,
      "capturedLengths.greeting",
    );
  }
  if (lengths.componentMarkup !== undefined) {
    if (value.componentMarkup === undefined)
      fail("MISSING_FIELD", "componentMarkup");
    lengthAt(
      lengths.componentMarkup,
      value.componentMarkup.length,
      "capturedLengths.componentMarkup",
    );
  }
  if (lengths.documents !== undefined) {
    lengthsAt(lengths.documents, value.documents, "capturedLengths.documents");
  }
  if (lengths.styles !== undefined) {
    lengthsAt(lengths.styles, value.styles, "capturedLengths.styles");
  }
}
