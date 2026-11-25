export function localIdentityFacts(persona: string) {
  const header = persona.slice(0, 1500);
  const line = header.match(
    /(?:^|\n)\s*[#*\-]*\s*(?:(?:[^\n：:]{1,20})的)?(?:姓名|名字|char_name|character_name|name)\s*[:：]\s*([^\n\r]+)/i,
  )?.[1];
  const name =
    line
      ?.trim()
      .split(/[（(\[【。，,；;]/)[0]
      .trim() ?? null;
  const ageLine = header.match(
    /(?:^|\n)\s*[#*\-]*\s*(?:(?:[^\n：:]{1,20})的)?(?:年龄|年齡|age)\s*[:：]\s*([^\n\r]+)/i,
  )?.[1];
  // Do not scan into NPC ages or turn a non-numeric supernatural age into an unrelated number.
  const ageMatch = ageLine
    ?.trim()
    .match(/^(\d{1,4})(?:\s*岁|\s*歳|\s*$|\s*\[|\s*\()/);
  return {
    name: name && !/[{}<>]/.test(name) && name.length <= 30 ? name : null,
    age: ageMatch ? Number(ageMatch[1]) : null,
    ageDescription: ageLine?.trim() ?? null,
  };
}
