import type { prepareMufyMigration } from "./mufy-migration";

type Prepared = ReturnType<typeof prepareMufyMigration>;
type Asset = { url?: unknown; ok?: unknown; dataUrl?: unknown; contentType?: unknown };

function removeEmptyNativeAudioControls(html: string): string {
  return html.replace(/<audio\b[^>]*\bsrc\s*=\s*(["'])\1[^>]*>/gi, (tag) =>
    tag
      .replace(/\s+src\s*=\s*(["'])\1/gi, "")
      .replace(/\s+controls(?:\s*=\s*(?:["'][^"']*["']|[^\s>]+))?/gi, "")
      .replace(/>$/, ' hidden data-mufy-audio-omitted="true">'),
  );
}

/** Explicitly authorized audio omission; images, CSS and identity gates remain strict. */
export function omitUnavailableMufyAudio(
  prepared: Prepared,
  assets: Asset[],
  allowed: boolean,
  allowImages = false,
): string[] {
  if (!allowed) return [];
  const visualText = [
    prepared.character.opening,
    prepared.beautification.openingComponent ?? "",
    prepared.beautification.globalCss ?? "",
  ].join("\n");
  const omitted = [
    ...new Set(
      assets
        .filter(
          (asset): asset is Asset & { url: string } =>
            typeof asset.url === "string" &&
            (/\.(?:mp3|m4a|wav|ogg|aac|flac|opus)(?:\?|$)/i.test(asset.url) || String(asset.contentType ?? "").startsWith("audio/") ||
              (allowImages && (/\.(?:avif|webp|png|jpe?g|gif|svg)(?:\?|$)/i.test(asset.url) || String(asset.contentType ?? "").startsWith("image/") || asset.url === prepared.character.avatarUrl || asset.url === prepared.character.coverImageUrl))) &&
            (allowImages || (asset.url !== prepared.character.avatarUrl && asset.url !== prepared.character.coverImageUrl)) &&
            !(asset.ok === true && typeof asset.dataUrl === "string") &&
            (visualText.includes(asset.url) || (allowImages && (asset.url === prepared.character.avatarUrl || asset.url === prepared.character.coverImageUrl))),
        )
        .map((asset) => asset.url),
    ),
  ];
  for (const url of omitted) {
    const isImage = allowImages && (/\.(?:avif|webp|png|jpe?g|gif|svg)(?:\?|$)/i.test(url) || String(assets.find(asset=>asset.url===url)?.contentType??"").startsWith("image/") || url === prepared.character.avatarUrl || url === prepared.character.coverImageUrl);
    if (isImage && prepared.character.avatarUrl === url) prepared.character.avatarUrl = null;
    if (isImage && prepared.character.coverImageUrl === url) prepared.character.coverImageUrl = null;
    // No substitute songs or fake successful media. Original source snapshots stay intact.
    prepared.character.opening = prepared.character.opening.split(url).join("");
    if (prepared.beautification.openingComponent)
      prepared.beautification.openingComponent =
        prepared.beautification.openingComponent.split(url).join("");
    if (prepared.beautification.globalCss)
      prepared.beautification.globalCss = prepared.beautification.globalCss
        .split(url)
        .join("");
    prepared.issues.push({
      level: "warning",
      code: isImage ? "MISSING_IMAGE_OMITTED_WITH_APPROVAL" : "MISSING_AUDIO_OMITTED_WITH_APPROVAL",
      message: `按用户授权省略未取得的${isImage ? "图片" : "音频"}，原始来源保留、列入后补清单：${url}`,
    });
  }
  if (omitted.length) {
    const hideEmptyImages = (html: string) => allowImages ? html.replace(/<img\b[^>]*\bsrc\s*=\s*(["'])\1[^>]*>/gi, tag => tag.replace(/\s+src\s*=\s*(["'])\1/gi, "").replace(/>$/, ' hidden data-mufy-image-omitted="true">')) : html;
    prepared.character.opening = hideEmptyImages(prepared.character.opening);
    if (prepared.beautification.openingComponent) prepared.beautification.openingComponent = hideEmptyImages(prepared.beautification.openingComponent);
    prepared.character.opening = removeEmptyNativeAudioControls(
      prepared.character.opening,
    );
    if (prepared.beautification.openingComponent)
      prepared.beautification.openingComponent = removeEmptyNativeAudioControls(
        prepared.beautification.openingComponent,
      );
  }
  return omitted;
}
