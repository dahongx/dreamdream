export const CHARACTER_TAG_OPTIONS = [
  "全性向",
  "女性向",
  "BG",
  "BL",
  "GL",
  "GB",
  "限左",
  "限右",
  "不限左右",
  "年上",
  "年下",
  "洁",
  "不洁",
  "群像",
  "模拟器",
  "架空世界",
  "纯爱",
  "治愈",
  "救赎",
  "古风",
  "校园",
  "系统",
  "难攻略",
  "无限流",
  "都市",
  "一见钟情",
  "ABO",
  "电竞",
  "刑侦",
  "娱乐圈",
  "星际",
  "恨海情天",
  "相爱相杀",
  "黑道",
  "背德",
  "高虐",
  "骨科",
] as const;

export type CharacterTag = (typeof CHARACTER_TAG_OPTIONS)[number];

export interface LocalizedCharacterTagOption {
  /** Stable value persisted in the database and written to explore URLs. */
  value: CharacterTag;
  /** Locale-specific presentation label. */
  label: string;
}

/**
 * Pair stable tag values with the aligned labels from the active dictionary.
 * Missing labels deliberately fall back to the canonical value so a malformed
 * dictionary never changes storage or filtering semantics.
 */
export function localizeCharacterTagOptions(
  labels: readonly string[],
): LocalizedCharacterTagOption[] {
  return CHARACTER_TAG_OPTIONS.map((value) => ({
    value,
    label: localizeCharacterTag(value, labels),
  }));
}

/** Localize a canonical platform tag; custom creator tags remain untouched. */
export function localizeCharacterTag(
  value: string,
  labels: readonly string[],
): string {
  const index = (CHARACTER_TAG_OPTIONS as readonly string[]).indexOf(value);
  return index >= 0 ? labels[index]?.trim() || value : value;
}

/** 单个标签长度上限(字符)。防止超长标签污染展示。 */
const MAX_TAG_LENGTH = 20;
/** 标签数量上限。 */
const MAX_TAGS = 20;

/**
 * 规范化角色标签。
 *
 * 不再强制标签必须在 CHARACTER_TAG_OPTIONS 固定库里 —— 保留**自定义标签**
 * (含从外部迁移过来的「悬疑」「双向奔赴」等)。只做:去空白、去重、限长、限量。
 * 固定库仍用于探索页筛选器和创建时的快捷勾选。
 */
export function normalizeCharacterTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, MAX_TAG_LENGTH);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    tags.push(trimmed);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}
