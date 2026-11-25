// Public theater only: no JS execution, no hidden Prompt changes.
export function publicAgeEvidence(
  html: unknown,
  name: string,
  expectedAge: number | null,
) {
  if (typeof html !== "string" || !name || expectedAge === null) return null;
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .normalize("NFKC")
    .replace(/\s+/g, " ");
  const escaped = name.normalize("NFKC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const forward = new RegExp(
    `${escaped}([^。.!?\\n\\d]{0,45}?)(\\d{1,3})\\s*岁`,
    "g",
  );
  for (const match of text.matchAll(forward)) {
    if (
      Number(match[2]) === expectedAge &&
      !/父亲|母亲|哥哥|弟弟|姐姐|妹妹|童年|当年|幼年/.test(match[1])
    )
      return {
        age: expectedAge,
        excerpt: match[0],
        source: "public-theater-named-age",
      };
  }
  const reverse = new RegExp(`\\b${expectedAge}\\s*岁的?${escaped}`, "g").exec(
    text,
  );
  if (reverse)
    return {
      age: expectedAge,
      excerpt: reverse[0],
      source: "public-theater-named-age",
    };
  return null;
}
