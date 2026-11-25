export function openingNarrativeText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .normalize("NFKC")
    .replace(/\s+/g, "");
}
export function openingsShareNarrative(local: string, live: string) {
  const a = openingNarrativeText(local);
  const b = openingNarrativeText(live);
  return a.length >= 100 && a === b;
}
