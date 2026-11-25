import { describe, expect, test } from "bun:test";
import {
  candidateFromApi,
  mergeObservations,
  type ProfileObservation,
  type ProfileReview,
  rankProfileCandidates,
  requireReviewedProfile,
  sourceFromRecord,
} from "../import/mufy-profiles";

const source = sourceFromRecord(
  {
    character_key: "key",
    character_name: "角色",
    text: "<CharaPrompt>人物</CharaPrompt>",
    variant_count: 500,
  },
  1,
);
const candidate = candidateFromApi({
  characterId: "14ead055-aea5-4687-ba5f-98ee14bbbf9d",
  name: "角色",
  totalLikes: 0,
  totalFollowers: 100,
  totalChats: 200,
});
const observation: ProfileObservation = {
  key: "key",
  query: "角色",
  observedAt: "2026-10-13T00:00:00Z",
  elapsedMs: 100,
  attempts: 1,
  status: "found",
  complete: true,
  candidates: [candidate],
};
const review: ProfileReview = {
  key: "key",
  roleId: candidate.roleId,
  promptSha256: source.promptSha256,
  status: "confirmed",
  evidence: "Compared source greeting and character identity",
  reviewedAt: "2026-10-13T00:00:00Z",
};
describe("Mufy profiles", () => {
  test("source keys cannot escape the handoff directory", () => {
    expect(() =>
      sourceFromRecord(
        { character_key: "../escape", character_name: "角色", text: "private" },
        1,
      ),
    ).toThrow();
  });
  test("incorrect source query is rejected", () => {
    expect(() =>
      mergeObservations([], [{ ...observation, query: "different" }], [source]),
    ).toThrow();
  });
  test("invalid popularity cannot enter snapshots", () => {
    expect(() =>
      mergeObservations(
        [],
        [{ ...observation, candidates: [{ ...candidate, likes: -1 }] }],
        [source],
      ),
    ).toThrow();
  });
  test("index omits raw Prompt; variants are not popularity", () => {
    expect(source).not.toHaveProperty("text");
    expect(source.variantCount).toBe(500);
  });
  test("missing is null and actual zero remains zero", () => {
    expect(candidate.likes).toBe(0);
    expect(candidate.author).toBeNull();
  });
  test("same name alone cannot authorize migration", () => {
    expect(() => requireReviewedProfile(source, [observation], [])).toThrow();
  });
  test("review binds candidate and exact Prompt hash", () => {
    expect(requireReviewedProfile(source, [observation], [review]).roleId).toBe(
      candidate.roleId,
    );
    expect(() =>
      requireReviewedProfile(
        { ...source, promptSha256: "changed" },
        [observation],
        [review],
      ),
    ).toThrow();
  });
  test("partial pagination cannot count as not found", () => {
    expect(() =>
      mergeObservations(
        [],
        [
          {
            ...observation,
            status: "not-found",
            complete: false,
            candidates: [],
          },
        ],
        [source],
      ),
    ).toThrow();
  });
  test("failed retry does not erase successful source data", () => {
    const failure = {
      ...observation,
      status: "failed" as const,
      complete: false,
      candidates: [],
      observedAt: "2026-10-13T01:00:00Z",
    };
    expect(mergeObservations([observation], [failure], [source])[0]).toEqual(
      observation,
    );
  });
  test("confirmed ranking excludes unreviewed names", () => {
    expect(
      rankProfileCandidates([source], [observation], [], "favorites"),
    ).toHaveLength(0);
    expect(
      rankProfileCandidates([source], [observation], [review], "favorites")[0]
        .candidate.favorites,
    ).toBe(100);
  });
  test("candidate ranking is explicitly unconfirmed", () => {
    expect(
      rankProfileCandidates([source], [observation], [], "likes", false)[0]
        .confirmed,
    ).toBe(false);
  });
  test("unknown keys cannot enter a task", () => {
    expect(() =>
      mergeObservations([], [{ ...observation, key: "other" }], [source]),
    ).toThrow();
  });
});
