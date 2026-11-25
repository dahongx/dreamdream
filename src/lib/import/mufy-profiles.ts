import { createHash } from "node:crypto";

export interface ProfileSource {
  key: string;
  name: string;
  aliases: string[];
  archiveLine: number;
  promptSha256: string;
  promptChars: number;
  variantCount: number | null;
}
export interface ProfileCandidate {
  roleId: string;
  name: string;
  author: string | null;
  tags: string[];
  likes: number | null;
  favorites: number | null;
  chats: number | null;
  updatedAt: string | null;
}
export interface ProfileObservation {
  key: string;
  query: string;
  observedAt: string;
  elapsedMs: number;
  attempts: number;
  status: "found" | "not-found" | "failed";
  complete: boolean;
  candidates: ProfileCandidate[];
  error?: string;
}
export interface ProfileReview {
  key: string;
  roleId: string;
  promptSha256: string;
  status: "confirmed" | "rejected";
  evidence: string;
  reviewedAt: string;
}
export function sourceFromRecord(value: unknown, line: number): ProfileSource {
  if (!value || typeof value !== "object")
    throw new Error(`Invalid record ${line}`);
  const r = value as Record<string, unknown>;
  if (
    typeof r.character_key !== "string" ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(r.character_key) ||
    typeof r.character_name !== "string" ||
    !r.character_name.trim() ||
    typeof r.text !== "string"
  ) {
    throw new Error(`Missing source fields at record ${line}`);
  }
  return {
    key: r.character_key,
    name: r.character_name,
    aliases: Array.isArray(r.character_aliases)
      ? r.character_aliases.filter((x): x is string => typeof x === "string")
      : [],
    archiveLine: line,
    promptSha256: createHash("sha256").update(r.text).digest("hex"),
    promptChars: r.text.length,
    variantCount: typeof r.variant_count === "number" ? r.variant_count : null,
  };
}
const count = (x: unknown): number | null =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null;
export function candidateFromApi(value: unknown): ProfileCandidate {
  if (!value || typeof value !== "object") throw new Error("Invalid candidate");
  const r = value as Record<string, unknown>;
  if (
    typeof r.characterId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(r.characterId) ||
    typeof r.name !== "string"
  )
    throw new Error("Invalid candidate identity");
  return {
    roleId: r.characterId,
    name: r.name,
    author: typeof r.creatorName === "string" ? r.creatorName : null,
    tags: Array.isArray(r.tags)
      ? r.tags.filter((x): x is string => typeof x === "string")
      : [],
    likes: count(r.totalLikes),
    favorites: count(r.totalFollowers),
    chats: count(r.totalChats),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
  };
}
export function mergeObservations(
  previous: ProfileObservation[],
  incoming: ProfileObservation[],
  sources: ProfileSource[],
): ProfileObservation[] {
  const keys = new Set(sources.map((s) => s.key));
  const map = new Map(previous.map((o) => [o.key, o]));
  for (const observation of incoming) {
    if (!keys.has(observation.key))
      throw new Error(`Unknown source key: ${observation.key}`);
    if (!Number.isFinite(Date.parse(observation.observedAt)))
      throw new Error("Invalid observation time");
    const source = sources.find((s) => s.key === observation.key);
    if (observation.query !== source?.name)
      throw new Error("Observation query does not match source identity");
    if (
      typeof observation.complete !== "boolean" ||
      !Number.isFinite(observation.elapsedMs) ||
      observation.elapsedMs < 0 ||
      !Number.isSafeInteger(observation.attempts) ||
      observation.attempts < 0
    )
      throw new Error("Invalid timing/completion fields");
    if (
      !Array.isArray(observation.candidates) ||
      !["found", "not-found", "failed"].includes(observation.status)
    )
      throw new Error("Invalid observation schema");
    if (
      observation.status === "not-found" &&
      (!observation.complete || observation.candidates.length)
    )
      throw new Error("Incomplete search cannot be not-found");
    if (observation.status === "found" && !observation.candidates.length)
      throw new Error("Found search has no candidates");
    for (const candidate of observation.candidates) {
      if (
        typeof candidate.roleId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          candidate.roleId,
        ) ||
        typeof candidate.name !== "string" ||
        !Array.isArray(candidate.tags)
      )
        throw new Error("Invalid stored candidate");
      for (const metric of [
        candidate.likes,
        candidate.favorites,
        candidate.chats,
      ])
        if (metric !== null && count(metric) === null)
          throw new Error("Invalid popularity count");
    }
    const old = map.get(observation.key);
    if (
      !old ||
      Date.parse(observation.observedAt) > Date.parse(old.observedAt)
    ) {
      // A failed retry must not erase previously successful observations.
      if (observation.status !== "failed" || !old || old.status === "failed")
        map.set(observation.key, {
          key: observation.key,
          query: observation.query,
          observedAt: observation.observedAt,
          elapsedMs: observation.elapsedMs,
          attempts: observation.attempts,
          status: observation.status,
          complete: observation.complete,
          candidates: observation.candidates.map((c) => ({
            roleId: c.roleId,
            name: c.name,
            author: typeof c.author === "string" ? c.author : null,
            tags: c.tags.filter((t) => typeof t === "string"),
            likes: c.likes,
            favorites: c.favorites,
            chats: c.chats,
            updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : null,
          })),
          ...(observation.error
            ? { error: observation.error.slice(0, 80) }
            : {}),
        });
    }
  }
  return [...map.values()];
}
export function requireReviewedProfile(
  source: ProfileSource,
  observations: ProfileObservation[],
  reviews: ProfileReview[],
): ProfileCandidate {
  const review = reviews.find(
    (r) => r.key === source.key && r.status === "confirmed",
  );
  if (
    !review ||
    !review.evidence.trim() ||
    review.promptSha256 !== source.promptSha256
  )
    throw new Error(
      "Profile identity/version is not confirmed for this Prompt",
    );
  const observation = observations.find(
    (o) => o.key === source.key && o.status === "found" && o.complete,
  );
  const candidate = observation?.candidates.find(
    (c) => c.roleId === review.roleId,
  );
  if (!candidate)
    throw new Error(
      "Reviewed role is missing from complete source observations",
    );
  return candidate;
}
export function rankProfileCandidates(
  sources: ProfileSource[],
  observations: ProfileObservation[],
  reviews: ProfileReview[],
  metric: "likes" | "favorites" | "chats",
  confirmedOnly = true,
) {
  return sources
    .flatMap((source) => {
      const observation = observations.find(
        (o) => o.key === source.key && o.status === "found" && o.complete,
      );
      if (!observation) return [];
      let candidates = observation.candidates;
      if (confirmedOnly) {
        try {
          candidates = [requireReviewedProfile(source, observations, reviews)];
        } catch {
          return [];
        }
      }
      return candidates
        .filter((c) => c[metric] !== null)
        .map((candidate) => ({
          source,
          candidate,
          observedAt: observation.observedAt,
          confirmed: confirmedOnly,
        }));
    })
    .sort(
      (a, b) =>
        (b.candidate[metric] ?? 0) - (a.candidate[metric] ?? 0) ||
        a.source.key.localeCompare(b.source.key),
    );
}
