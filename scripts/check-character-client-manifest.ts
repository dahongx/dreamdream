import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

type Entry = { id: number | string; chunks: string[] };
type Manifest = {
  clientModules: Record<string, Entry>;
  ssrModuleMapping: Record<string, unknown>;
};

export function checkCharacterManifest(source: string, label: string) {
  const context: { __RSC_MANIFEST?: Record<string, Manifest> } = {};
  runInNewContext(source, context, { timeout: 1000 });
  const manifests = Object.values(context.__RSC_MANIFEST ?? {});
  if (manifests.length !== 1) throw new Error(`${label}: invalid manifest`);
  const manifest = manifests[0];
  const entry = Object.entries(manifest.clientModules).find(([path]) =>
    path
      .replaceAll("\\", "/")
      .endsWith("/components/characters/CharacterEngagementButtons.tsx"),
  )?.[1];
  if (
    !entry ||
    entry.id == null ||
    !manifest.ssrModuleMapping[String(entry.id)]
  ) {
    throw new Error(
      `${label}: missing CharacterEngagementButtons client/SSR mapping`,
    );
  }
  // Intercepted routes may inherit chunks from their parent layout/entry.
  // An empty local chunk list is valid; the client/SSR module mapping is required.
}

if (import.meta.main) {
  const root = resolve(process.argv[2] ?? ".next");
  // Both direct visits and the explore intercepted modal must remain renderable.
  for (const route of ["characters/[id]", "explore"]) {
    checkCharacterManifest(
      readFileSync(
        resolve(root, "server/app", route, "page_client-reference-manifest.js"),
        "utf8",
      ),
      route,
    );
  }
  console.log(
    "Character client manifests verified (direct page + explore modal)",
  );
}
