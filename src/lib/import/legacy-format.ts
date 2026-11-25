/**
 * 外部角色卡 / 美化导出格式的**字面量**集中地。
 *
 * 这里的字符串不是我们的命名，是来源平台的导出格式规定的 —— 改任何一个，
 * 已有的导出文件就解析不出来 / 老美化包的选择器就命中不了。所以全仓只在本文件
 * 出现一次，其余代码一律引用常量。
 *
 * 无依赖、可安全被客户端渲染路径（styling/whitelist.ts）引用；解析器那侧的
 * 重依赖（fast-xml-parser）留在 external-card.ts，不要往这里挪。
 */

/** 外部角色卡 XML 的根节点名。 */
export const EXTERNAL_CARD_ROOT_TAG = "mufy-character";

/**
 * 外部美化 CSS 的选择器前缀。来源平台的界面选择器和我们的 `nj_*` 是镜像关系，
 * 元素名一一对应，只差这个前缀，因此前缀改名就是完整的翻译。
 */
export const LEGACY_SELECTOR_PREFIX = "mufy_";

/** {@link LEGACY_SELECTOR_PREFIX} 的全局改名正则，唯一构造点。 */
export const LEGACY_SELECTOR_PREFIX_RE = new RegExp(
  LEGACY_SELECTOR_PREFIX,
  "g",
);

/** 把一段 CSS 里的外部选择器前缀全量改成寄情的 `nj_`。 */
export function renameLegacySelectors(css: string): string {
  return css.replace(LEGACY_SELECTOR_PREFIX_RE, "nj_");
}
