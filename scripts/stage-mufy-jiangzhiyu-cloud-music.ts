/** Public DOM and literal playlist extraction, no source program execution. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { publicVariableDeclaration } from "../src/lib/import/mufy-public-prefix-extractor";
import {
  nativeImageSidebarEnvelope,
  validNativeCloudMusic,
  type NativeImageSidebar,
} from "../src/lib/opening/native-image-sidebar";
import { routeOpeningContentSplit } from "../src/lib/opening/content";
const startedAt = new Date().toISOString(),
  tick = performance.now(),
  root = "logs/mufy-profiles/full-20261013/next-batch-30-20261028",
  out = root + "/rule-repairs/46/native-cloud-music";
const evidence = JSON.parse(
    await readFile(
      root + "/final-acceptance/46/source-floating-music-check.json",
      "utf8",
    ),
  ),
  source = new JSDOM(evidence.sourceMusicDocument);
const programs = [...source.window.document.scripts]
  .map((s) => s.textContent ?? "")
  .filter((s) =>
    s.includes(
      "var COMPONENT_ID = 'mufy_permanent_cloud_music_isolated_JiangHu_Playlist';",
    ),
  );
if (programs.length !== 1 || evidence.styles.length !== 1)
  throw Error("CLOUD_PUBLIC_PROGRAM_BOUNDARY_CHANGED");
const init = publicVariableDeclaration(programs[0], "playlist").initializer;
if (!init || !ts.isArrayLiteralExpression(init))
  throw Error("CLOUD_LITERAL_PLAYLIST_REQUIRED");
const tracks = init.elements.map((e) => {
  if (!ts.isObjectLiteralExpression(e))
    throw Error("CLOUD_LITERAL_TRACK_REQUIRED");
  const p = new Map(
      e.properties
        .filter(ts.isPropertyAssignment)
        .map((x) => [x.name.getText(), x.initializer]),
    ),
    title = p.get("title"),
    src = p.get("src");
  if (!title || !src || !ts.isStringLiteral(title) || !ts.isStringLiteral(src))
    throw Error("CLOUD_TRACK_STRINGS_REQUIRED");
  return { title: title.text, src: src.text };
});
const lineHeight =
    parseFloat(evidence.inheritedPresentation.lineHeight) /
    parseFloat(evidence.inheritedPresentation.fontSize),
  cloudMusic = {
    id: "JiangHu_Playlist",
    tracks,
    lineHeight,
    initialDisabled: evidence.powerDisabled,
  };
if (!validNativeCloudMusic(cloudMusic) || tracks.length !== 2)
  throw Error("CLOUD_CONFIG_BOUNDARY_CHANGED");
const dom = new JSDOM(evidence.publicWrapper),
  wrapper = dom.window.document.getElementById("wrapper"),
  audio = wrapper?.querySelector("audio");
if (
  !wrapper ||
  !audio ||
  audio.getAttribute("src") !== tracks[0].src ||
  wrapper.querySelectorAll("audio").length !== 1 ||
  !wrapper.querySelector("#trigger") ||
  !wrapper.querySelector("#btn-top") ||
  !wrapper.querySelector("#btn-bottom")
)
  throw Error("CLOUD_PUBLIC_SHELL_REQUIRED");
wrapper.classList.remove("open");
wrapper.classList.add("cloud-music-sidebar");
wrapper.querySelector("#bar")?.removeAttribute("style");
wrapper.querySelector("#cover")?.removeAttribute("style");
const spec: NativeImageSidebar = {
  version: 1,
  variant: "cloud-music",
  shellHtml: wrapper.outerHTML,
  css: evidence.styles[0],
  documents: [],
  cloudMusic,
};
if (
  routeOpeningContentSplit(nativeImageSidebarEnvelope(spec), "cloud")
    .floating[0]?.nativeImageSidebar?.variant !== "cloud-music"
)
  throw Error("CLOUD_ROUTE_FAILED");
const baseline = await readFile(
  root + "/rule-repairs/46/composer-prefix/candidate-opening.txt",
  "utf8",
);
if (baseline.includes("cloud-music-sidebar"))
  throw Error("EXISTING_CLOUD_CANDIDATE_REQUIRES_REVIEW");
const candidate = baseline + "\n" + nativeImageSidebarEnvelope(spec),
  hash = (s: string) => createHash("sha256").update(s).digest("hex");
await mkdir(out, { recursive: true });
await writeFile(out + "/sidebar-spec.json", JSON.stringify(spec, null, 2));
await writeFile(out + "/candidate-opening.txt", candidate);
const proof = {
  rank: 46,
  observedAt: new Date().toISOString(),
  startedAt,
  elapsedMs: performance.now() - tick,
  sourceTracks: tracks.length,
  nativeAudio: true,
  authorProgramExecuted: false,
  sourceStorageRead: false,
  baselineSha256: hash(baseline),
  candidateSha256: hash(candidate),
  allOriginalCharactersPreserved: candidate.startsWith(baseline),
  baselineRequiresFreshOwnerUiVerification: true,
  ownerUiSaved: false,
  deployed: false,
  fullFidelityAccepted: false,
};
await writeFile(out + "/candidate-proof.json", JSON.stringify(proof, null, 2));
source.window.close();
dom.window.close();
console.log(JSON.stringify(proof));
