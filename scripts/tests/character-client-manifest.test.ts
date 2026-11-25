import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { checkCharacterManifest } from "../check-character-client-manifest";

function fixture(id: number | string = 0, missing = false) {
  return `globalThis.__RSC_MANIFEST = ${JSON.stringify({
    page: {
      clientModules: missing
        ? {}
        : {
            "/app/src/components/characters/CharacterEngagementButtons.tsx": {
              id,
              chunks: ["2124", "static/chunks/2124.js"],
            },
          },
      ssrModuleMapping: { [id]: { "*": { id: "123" } } },
    },
  })}`;
}

describe("character client manifest regression", () => {
  test("module ID zero is a valid reference", () => {
    expect(() => checkCharacterManifest(fixture(), "test")).not.toThrow();
  });
  test("nonzero/string IDs remain valid", () => {
    expect(() => checkCharacterManifest(fixture("456"), "test")).not.toThrow();
  });
  test("intercepted route can inherit parent chunks", () => {
    const inherited = fixture().replace(
      '["2124","static/chunks/2124.js"]',
      "[]",
    );
    expect(() => checkCharacterManifest(inherited, "explore")).not.toThrow();
  });
  test("missing reference blocks release", () => {
    expect(() => checkCharacterManifest(fixture(0, true), "test")).toThrow(
      "missing",
    );
  });
  for (const folder of ["dist", "dist/esm"]) {
    test(`${folder} patched concatenated module guard accepts zero`, () => {
      const plugin = readFileSync(
        `node_modules/next/${folder}/build/webpack/plugins/flight-manifest-plugin.js`,
        "utf8",
      );
      const guard = plugin.match(
        /if \((concatenatedModId[^\n]+)\) \{\s*recordModule\(concatenatedModId/,
      );
      expect(guard).not.toBeNull();
      if (!guard) throw new Error("Missing manifest guard");
      const accepts = new Function(
        "concatenatedModId",
        `return (${guard[1]});`,
      );
      expect(accepts(0)).toBe(true);
      expect(accepts(123)).toBe(true);
      expect(accepts(null)).toBe(false);
      expect(accepts(undefined)).toBe(false);
    });
  }
});
