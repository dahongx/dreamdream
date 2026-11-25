import { expect, test } from "bun:test";
import {
  applyComposerPrefix,
  applyScopedComposerPrefix,
  composerPrefixEnvelope,
  extractComposerPrefixes,
  readPrefixSelection,
  restoreDeletedPrefix,
  uniqueComposerPrefix,
  type ComposerPrefixSpec,
} from "../opening/composer-prefix";
import {
  interpolateOpening,
  routeOpeningContentSplit,
} from "../opening/content";
const spec: ComposerPrefixSpec = {
  version: 1,
  id: "fixture-prefix",
  css: "#mufy-bw-panel{color:inherit}",
  presets: [
    { id: "a", text: "one {{user}} <tag>" },
    { id: "b", text: "two\nthree" },
  ],
};
test("stale selection cannot apply during a session or character scope switch", () => {
  const value = {
      presets: spec.presets,
      activeIds: ["a"],
      mode: "before" as const,
    },
    owned = { scope: "A:source-38", value };
  expect(applyScopedComposerPrefix("draft", owned, "A:source-38")).toBe(
    "one {{user}} <tag>\ndraft",
  );
  expect(applyScopedComposerPrefix("draft", owned, "B:source-38")).toBe(
    "draft",
  );
  expect(applyScopedComposerPrefix("draft", owned, "A:source-46")).toBe(
    "draft",
  );
  expect(applyScopedComposerPrefix("draft", null, "A:source-38")).toBe("draft");
});
test("prefix envelope is inert, quote-safe, and does not render a duplicate inline UI", () => {
  const raw = composerPrefixEnvelope(spec);
  expect(raw).not.toContain("<tag>");
  expect(extractComposerPrefixes(raw).specs).toEqual([spec]);
  expect(interpolateOpening(raw, { char: "C", user: '"</template>' })).toBe(
    raw,
  );
  expect(routeOpeningContentSplit(raw, "fixture").inline).toBeNull();
  expect(uniqueComposerPrefix([raw])).toEqual(spec);
  expect(uniqueComposerPrefix([raw, raw])).toBeNull();
});
test("only selected public instructions are composed once at manual send; input is unchanged", () => {
  const s = readPrefixSelection(null, spec);
  expect(applyComposerPrefix("draft", s)).toBe("draft");
  s.activeIds = ["b", "a", "a"];
  expect(applyComposerPrefix("draft", s)).toBe(
    "one {{user}} <tag>two\nthree\ndraft",
  );
  expect(s.activeIds).toEqual(["b", "a", "a"]);
  s.mode = "after";
  expect(applyComposerPrefix("draft", s)).toBe(
    "draft\none {{user}} <tag>two\nthree",
  );
  expect(applyComposerPrefix(" ", s)).toBe(" ");
  expect(applyComposerPrefix("draft", null)).toBe("draft");
});
test("selection storage is schema bounded and resets invalid data without accepting unknown active ids", () => {
  const s = readPrefixSelection(
    JSON.stringify({
      presets: spec.presets,
      activeIds: ["b", "b", "missing"],
      mode: "after",
    }),
    spec,
  );
  expect(s.activeIds).toEqual(["b"]);
  expect(s.mode).toBe("after");
  for (const bad of [
    "{",
    JSON.stringify({
      presets: [
        { id: "a", text: "x" },
        { id: "a", text: "y" },
      ],
      activeIds: [],
      mode: "before",
    }),
    JSON.stringify({ presets: [], activeIds: [], mode: "bad" }),
  ])
    expect(readPrefixSelection(bad, spec).activeIds).toEqual([]);
  expect(
    extractComposerPrefixes(
      composerPrefixEnvelope({
        ...spec,
        presets: [{ id: "a", text: "x".repeat(40001) }],
      }),
    ).specs,
  ).toHaveLength(0);
});
test("undo restores only the removed entry without rolling back later edits or mode changes", () => {
  const current = {
      presets: [{ id: "b", text: "later edited text" }],
      activeIds: ["b"],
      mode: "after" as const,
    },
    removed = { preset: spec.presets[0], index: 0, wasActive: true };
  const next = restoreDeletedPrefix(current, removed);
  expect(next.mode).toBe("after");
  expect(next.presets[1].text).toBe("later edited text");
  expect(next.activeIds).toEqual(["b", "a"]);
  expect(restoreDeletedPrefix(next, removed)).toBe(next);
  const full = {
    ...current,
    presets: Array.from({ length: 50 }, (_, i) => ({ id: "x" + i, text: "x" })),
  };
  expect(restoreDeletedPrefix(full, removed)).toBe(full);
});
