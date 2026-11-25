import { describe, expect, test } from "bun:test";
import { filterOwnerOpeningPacks } from "@/lib/opening/access";

describe("opening component owner boundary", () => {
  test("keeps only packs owned by the character creator", () => {
    const packs = [
      { id: "mine-private", ownerUserId: "creator", isPublic: false },
      { id: "foreign-public", ownerUserId: "someone-else", isPublic: true },
      { id: "mine-public", ownerUserId: "creator", isPublic: true },
      { id: "mine-public", ownerUserId: "creator", isPublic: true },
    ];

    expect(filterOwnerOpeningPacks(packs, "creator")).toEqual([
      packs[0],
      packs[2],
    ]);
  });
});
