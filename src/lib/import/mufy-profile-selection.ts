import type { rankProfileCandidates } from "./mufy-profiles";

export const TEST_PROFILE_HOST = "115.29.213.73";
export interface TestProfileInventory {
  version: 1;
  environment: "test";
  host: string;
  capturedAt: string;
  complete: true;
  characters: { id: string; name: string }[];
}
const normalized = (name: string) =>
  name.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
// This is only a rejection filter, never proof of identity/version.
export function hasCompatibleSourceName(
  row: ReturnType<typeof rankProfileCandidates>[number],
) {
  const candidate = normalized(row.candidate.name);
  return [row.source.name, ...row.source.aliases].some((value) => {
    const name = normalized(value);
    return (
      !!name &&
      (candidate === name ||
        ["(", "[", "|", "/"].some((separator) =>
          candidate.startsWith(name + separator),
        ))
    );
  });
}
export function hasUnmatchedVariantQualifier(
  row: ReturnType<typeof rankProfileCandidates>[number],
) {
  const candidate = normalized(row.candidate.name);
  const names = [row.source.name, ...row.source.aliases]
    .map(normalized)
    .filter(Boolean);
  if (names.includes(candidate)) return false;
  return names.some(
    (name) =>
      candidate.startsWith(name) &&
      /(?:\d{1,3}岁(?:社畜|刑警|校园)?版|魔尊版|社畜版|高中懈怠期|男高版|易感期|不用打拼版|if线|刑警版)/i.test(
        candidate.slice(name.length),
      ),
  );
}
export function requireVerifiedSelection(value: unknown) {
  const selection = value as {
    status?: unknown;
    rows?: unknown;
    requested?: unknown;
  } | null;
  if (
    !selection ||
    selection.status !== "verified" ||
    !Array.isArray(selection.rows) ||
    !Number.isSafeInteger(selection.requested) ||
    selection.requested !== selection.rows.length ||
    !selection.rows.length
  )
    throw new Error("选卡步骤尚未完整验收；候选/待确认名单不得进入迁移编排");
  const ids = new Set<string>();
  for (const raw of selection.rows) {
    const row = raw as {
      candidate?: { roleId?: string };
      source?: { key?: string; promptSha256?: string };
      confirmed?: boolean;
      verification?: {
        identityEvidence?: string;
        versionEvidence?: string;
        targetAbsenceEvidence?: string;
        promptSha256?: string;
      };
    } | null;
    const proof = row?.verification;
    if (
      !row?.candidate?.roleId ||
      ids.has(row.candidate.roleId) ||
      !row.source?.key ||
      !row.source.promptSha256 ||
      row.confirmed !== true ||
      !proof ||
      proof.promptSha256 !== row.source.promptSha256 ||
      !proof.identityEvidence?.trim() ||
      !proof.versionEvidence?.trim() ||
      !proof.targetAbsenceEvidence?.trim()
    )
      throw new Error("选卡验收缺少逐卡身份、Prompt版本或测试服不存在的证据");
    ids.add(row.candidate.roleId);
  }
}
export function validateTestInventory(
  value: unknown,
  now = Date.now(),
): TestProfileInventory {
  const v = value as TestProfileInventory | null;
  if (
    !v ||
    v.version !== 1 ||
    v.environment !== "test" ||
    v.host !== TEST_PROFILE_HOST ||
    v.complete !== true ||
    !Array.isArray(v.characters)
  )
    throw new Error(
      "A complete TEST inventory is required; production inventories are forbidden",
    );
  const age = now - Date.parse(v.capturedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > 24 * 60 * 60 * 1000)
    throw new Error("TEST inventory expired; refresh before selection/handoff");
  for (const c of v.characters) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      typeof c.name !== "string" ||
      !c.name.trim()
    )
      throw new Error("Invalid TEST character inventory");
  }
  return v;
}
export function selectNewTestProfiles(
  ranked: ReturnType<typeof rankProfileCandidates>,
  inventory: TestProfileInventory,
  top: number,
) {
  validateTestInventory(inventory);
  if (!Number.isSafeInteger(top) || top < 1)
    throw new Error("Invalid selection size");
  const seen = new Set<string>();
  const excluded: {
    roleId: string;
    name: string;
    reason: string;
    targetIds: string[];
  }[] = [];
  const eligible: typeof ranked = [];
  const rejectedPairs: {
    roleId: string;
    candidateName: string;
    sourceKey: string;
    sourceName: string;
    reason: string;
  }[] = [];
  for (const row of ranked) {
    // Reject this association before roleId dedup so another correctly named local source can replace it.
    if (!hasCompatibleSourceName(row)) {
      rejectedPairs.push({
        roleId: row.candidate.roleId,
        candidateName: row.candidate.name,
        sourceKey: row.source.key,
        sourceName: row.source.name,
        reason: "source-name-incompatible",
      });
      continue;
    }
    if (hasUnmatchedVariantQualifier(row)) {
      rejectedPairs.push({
        roleId: row.candidate.roleId,
        candidateName: row.candidate.name,
        sourceKey: row.source.key,
        sourceName: row.source.name,
        reason: "unmatched-explicit-version",
      });
      continue;
    }
    if (seen.has(row.candidate.roleId)) continue;
    seen.add(row.candidate.roleId);
    const name = normalized(row.candidate.name);
    // Preserve version qualifiers: a shared base name is held for review, not declared identical.
    const matches = inventory.characters.filter((c) => {
      const existing = normalized(c.name);
      return (
        name === existing ||
        name.startsWith(`${existing}(`) ||
        existing.startsWith(`${name}(`)
      );
    });
    if (matches.length) {
      excluded.push({
        roleId: row.candidate.roleId,
        name: row.candidate.name,
        reason: matches.some((c) => normalized(c.name) === name)
          ? "test-name-collision"
          : "test-version-name-review",
        targetIds: matches.map((c) => c.id),
      });
    } else eligible.push(row);
  }
  return {
    rows: eligible.slice(0, top),
    excluded,
    eligibleCount: eligible.length,
    rejectedPairs,
  };
}
