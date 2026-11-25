/** Public CSS/default presets only. Never reads browser/source storage. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extractKnownPublicPrefix } from "../src/lib/import/mufy-public-prefix-extractor";
import { composerPrefixEnvelope } from "../src/lib/opening/composer-prefix";
const root = "logs/mufy-profiles/full-20261013/next-batch-30-20261028",
  hash = (s: string) => createHash("sha256").update(s).digest("hex");
for (const rank of [38, 46]) {
  const dir = `${root}/final-acceptance/${rank}`,
    out = `${root}/rule-repairs/${rank}/composer-prefix`;
  const input =
    rank === 38
      ? await readFile(dir + "/source-prefix-public-frame.html", "utf8")
      : JSON.parse(
          await readFile(dir + "/source-floating-music-check.json", "utf8"),
        ).sourceDocument;
  const observed = JSON.parse(
    await readFile(dir + "/source-prefix-controls-check.json", "utf8"),
  );
  const spec = extractKnownPublicPrefix(
    input,
    `source-prefix-${rank}`,
    observed.triggerColor,
    observed.panelColor,
  );
  const baselinePath =
    rank === 38
      ? `${root}/rule-repairs/38/native-zen-music/candidate-opening.txt`
      : dir + "/owner-opening-current-20261031.txt";
  const baseline = await readFile(baselinePath, "utf8");
  const currentOwner = JSON.parse(await readFile(dir + "/owner-baseline-current-20261031.json", "utf8"));
  if (!currentOwner.characters || !currentOwner.codeEditorConfirmedByReturnToList)
    throw Error("FRESH_OWNER_CODE_EDITOR_PROOF_REQUIRED");
  if (rank === 46) {
    if (hash(baseline) !== currentOwner.sha256)
      throw Error("CURRENT_OWNER_BASELINE_CHANGED");
  } else {
    const nativeProof = JSON.parse(await readFile(`${root}/rule-repairs/38/native-zen-music/candidate-proof.json`, "utf8"));
    if (nativeProof.baselineSha256 !== currentOwner.sha256 || nativeProof.candidateSha256 !== hash(baseline))
      throw Error("NATIVE_CANDIDATE_MUST_PRESERVE_CURRENT_OWNER");
  }
  if (baseline.includes("data-nj-composer-prefix-v1"))
    throw Error("EXISTING_PREFIX_CANDIDATE_REQUIRES_REVIEW");
  const candidate = baseline + "\n" + composerPrefixEnvelope(spec);
  await mkdir(out, { recursive: true });
  await writeFile(out + "/prefix-spec.json", JSON.stringify(spec, null, 2));
  await writeFile(out + "/candidate-opening.txt", candidate);
  const proof = {
    rank,
    observedAt: new Date().toISOString(),
    publicPresets: spec.presets.length,
    publicCssOnly: true,
    authorProgramExecuted: false,
    sourceStorageRead: false,
    baselineSha256: hash(baseline),
    candidateSha256: hash(candidate),
    allOriginalCharactersPreserved: candidate.startsWith(baseline),
    baselineRequiresFreshOwnerUiVerification: true,
    ownerBaselineVerifiedAt: currentOwner.observedAt,
    ownerUiSaved: false,
    deployed: false,
    fullFidelityAccepted: false,
  };
  await writeFile(
    out + "/candidate-proof.json",
    JSON.stringify(proof, null, 2),
  );
  console.log(JSON.stringify(proof));
}
