import { describe, expect, test } from "bun:test";
import {
  isOriginatingTurnCurrent,
  isRegenerationTargetCurrent,
  shouldSupersedeOriginatingUser,
} from "@/lib/chat/turn-lifecycle";

describe("isOriginatingTurnCurrent", () => {
  test("accepts a reply while its user message is still the session tail", () => {
    expect(
      isOriginatingTurnCurrent("user-1", { id: "user-1", role: "user" }),
    ).toBe(true);
  });

  test("rejects a reply after a newer user message is submitted", () => {
    expect(
      isOriginatingTurnCurrent("user-1", { id: "user-2", role: "user" }),
    ).toBe(false);
  });

  test("rejects a duplicate reply after another assistant already landed", () => {
    expect(
      isOriginatingTurnCurrent("user-1", {
        id: "assistant-1",
        role: "assistant",
      }),
    ).toBe(false);
  });

  test("rejects a reply after its user message was deleted", () => {
    expect(isOriginatingTurnCurrent("user-1", undefined)).toBe(false);
  });
});

describe("isRegenerationTargetCurrent", () => {
  test("accepts replacement while the rejected assistant is still the tail", () => {
    expect(
      isRegenerationTargetCurrent("assistant-1", {
        id: "assistant-1",
        role: "assistant",
      }),
    ).toBe(true);
  });

  test("rejects replacement after a newer turn changes the tail", () => {
    expect(
      isRegenerationTargetCurrent("assistant-1", {
        id: "user-2",
        role: "user",
      }),
    ).toBe(false);
  });

  test("rejects replacement when the target was removed", () => {
    expect(isRegenerationTargetCurrent("assistant-1", undefined)).toBe(false);
  });
});

describe("shouldSupersedeOriginatingUser", () => {
  test("supersedes the orphan user row after a fresh-turn stream error", () => {
    expect(shouldSupersedeOriginatingUser(false, "user-1")).toBe(true);
  });

  test("skips supersede for regenerate errors (user row pre-existed)", () => {
    expect(shouldSupersedeOriginatingUser(true, "user-1")).toBe(false);
  });

  test("skips supersede when no originating user id was recorded", () => {
    expect(shouldSupersedeOriginatingUser(false, null)).toBe(false);
  });
});
