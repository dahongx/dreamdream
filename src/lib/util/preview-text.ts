/**
 * 提取消息文本预览 —— /sessions「最近会话」「我的收藏」卡片用。
 *
 * 目标:把 markdown / HTML / 多余空白塞回成一行裸文字,截断到指定长度
 * 加省略号。不调 DOMPurify(server side,不想跑 jsdom),用最朴素的正则。
 *
 * 输入示例:
 *   `**早安**\n\n<p>"那就回珑湾半岛。"</p>` → `早安 "那就回珑湾半岛。"`
 *
 * 输出始终为单行,无 HTML/markdown 残留。length 默认 60(单卡片单行可容纳)。
 */
export function previewSnippet(
  raw: string | null | undefined,
  length = 60,
): string | null {
  if (!raw) return null;
  // 去 HTML 标签
  let text = raw.replace(/<[^>]+>/g, " ");
  // 去 markdown 强调 / 标题 / 链接外壳
  text = text
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) / ![alt](url)
    .replace(/[*_~`#>]+/g, "") // 强调 / 删除线 / 行内代码 / 标题
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1"); // 反斜杠转义
  // 折叠空白
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= length) return text;
  return `${text.slice(0, length).trim()}…`;
}
