/** Every observed public source block needs an explicit, unique disposition.
 * Import counts, text samples and a few working folds are not acceptance.
 */
export type PublicComponentDisposition = {
  /** Older records without this field refer only to root 0. */
  sourceRootIndex?: number;
  sourceIndex: number;
  status: "matched" | "source-unavailable" | "nonvisual-helper" | "pending";
  evidence: string;
  reason?: string;
  targetUiVerified?: boolean;
  /** Explicit visual/interaction/media verdict, separate from correspondence. */
  fidelityVerified?: boolean;
};

/** Root-local frame indices are not globally unique. Zero-area frames still
 * count: an authored program can render its UI in the parent document. */
export function publicRootComponentCoverage(
  roots: readonly { frames: readonly { index: number }[] }[],
  rows: readonly PublicComponentDisposition[],
) {
  const expected = roots.flatMap((root, rootIndex) =>
    root.frames.map((frame) => `${rootIndex}:${frame.index}`),
  );
  if (new Set(expected).size !== expected.length)
    throw Error("DUPLICATE_SOURCE_FRAME_ID");
  const expectedSet = new Set(expected),
    seen = new Set<string>();
  const invalid: string[] = [],
    duplicates: string[] = [],
    unresolved: string[] = [];
  for (const row of rows) {
    const root = row.sourceRootIndex ?? 0;
    const key = `${root}:${row.sourceIndex}`;
    if (
      !Number.isSafeInteger(root) ||
      root < 0 ||
      !Number.isSafeInteger(row.sourceIndex) ||
      row.sourceIndex < 0 ||
      !expectedSet.has(key)
    ) {
      invalid.push(key);
      continue;
    }
    if (seen.has(key)) {
      duplicates.push(key);
      continue;
    }
    seen.add(key);
    if (
      row.status === "pending" ||
      !row.evidence.trim() ||
      (row.status === "matched" && row.targetUiVerified !== true) ||
      ((row.status === "source-unavailable" ||
        row.status === "nonvisual-helper") &&
        !row.reason?.trim())
    )
      unresolved.push(key);
  }
  const missing = expected.filter((key) => !seen.has(key));
  const fullyChecked =
    expected.length > 0 &&
    !missing.length &&
    !invalid.length &&
    !duplicates.length &&
    !unresolved.length;
  const fidelityPending = rows
    .filter((row) => row.status === "matched" && row.fidelityVerified !== true)
    .map((row) => `${row.sourceRootIndex ?? 0}:${row.sourceIndex}`);
  return {
    expectedSourceBlocks: expected.length,
    mapped: seen.size,
    missing,
    invalid,
    duplicates,
    unresolved,
    fullyChecked,
    fidelityPending,
    fullFidelityAccepted:
      fullyChecked &&
      !fidelityPending.length &&
      !rows.some((row) => row.status === "source-unavailable"),
  };
}

/** The legacy preparation path only converts one root. Refuse additional
 * captured roots instead of silently losing their UI or executing parent JS. */
export function singleMufyPublicOpeningRoot(
  blocks: readonly { html: string }[],
): string {
  if (!blocks.length || !blocks[0].html.trim())
    throw Error("PUBLIC_OPENING_ROOT_REQUIRED");
  const extra = blocks.flatMap((block, index) =>
    index > 0 && block.html.trim() ? [index] : [],
  );
  if (extra.length)
    throw Error(`UNRESOLVED_ADDITIONAL_PUBLIC_ROOTS:${extra.join(",")}`);
  return blocks[0].html;
}
export function publicComponentCoverage(
  expectedSourceBlocks: number,
  rows: PublicComponentDisposition[],
) {
  if (!Number.isSafeInteger(expectedSourceBlocks) || expectedSourceBlocks < 0)
    throw Error("INVALID_SOURCE_COMPONENT_BASE");
  const seen = new Set<number>();
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.sourceIndex) ||
      row.sourceIndex < 0 ||
      row.sourceIndex >= expectedSourceBlocks ||
      seen.has(row.sourceIndex)
    )
      throw Error("INVALID_OR_DUPLICATE_COMPONENT_MAPPING");
    seen.add(row.sourceIndex);
  }
  const missing = Array.from(
    { length: expectedSourceBlocks },
    (_, i) => i,
  ).filter((i) => !seen.has(i));
  const unresolved = rows
    .filter(
      (row) =>
        row.status === "pending" ||
        !row.evidence.trim() ||
        (row.status === "matched" && row.targetUiVerified !== true) ||
        ((row.status === "source-unavailable" ||
          row.status === "nonvisual-helper") &&
          !row.reason?.trim()),
    )
    .map((row) => row.sourceIndex);
  const fullyChecked =
    expectedSourceBlocks > 0 && missing.length === 0 && unresolved.length === 0;
  const fidelityPending = rows
    .filter((row) => row.status === "matched" && row.fidelityVerified !== true)
    .map((row) => row.sourceIndex);
  return {
    expectedSourceBlocks,
    mapped: seen.size,
    missing,
    unresolved,
    fullyChecked,
    fidelityPending,
    fullFidelityAccepted:
      fullyChecked &&
      fidelityPending.length === 0 &&
      !rows.some((row) => row.status === "source-unavailable"),
    qualifiedSourceFailures: rows
      .filter((row) => row.status === "source-unavailable")
      .map((row) => row.sourceIndex),
  };
}
