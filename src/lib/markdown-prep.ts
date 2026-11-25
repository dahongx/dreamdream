/**
 * Markdown 预处理：把 LLM/creator 原始输出整理成 react-markdown 友好的形状。
 *
 * 两个步骤：
 *   1. ensureBlockSeparation —— 在 message/narration/system/... 等语义标签
 *      前后强制插空行，避免被 CommonMark 自动包进 <p>。
 *   2. normalizeHtmlBlocks —— 进到 <div>/<details> 等 block-level HTML 内部
 *      之后，把行首空白 dedent、把空行折叠。原因：creator 经常在 prompt 范本
 *      里贴带 8-10 空格缩进 + 内部空行的 HTML，模型照抄之后 CommonMark 会
 *      (a) 在第一处空行就终结 type-6 HTML block，(b) 把后续 ≥4 空格行识别成
 *      indented code block —— 整段 HTML 范本退化成"暴露代码"打印到聊天页。
 *      贺韫 / 程彧 case 即此 bug。
 *
 * 两个 helper 都是纯函数；React 那一层只是用 useMemo 串起来。
 */

const BLOCK_TAG_PATTERN =
  /(<\/?(?:message|mes|user|usr|narration|nar|system|sys|scenario|sce|think|artifact)(?:\s[^>]*)?>)/gi;

export function ensureBlockSeparation(source: string): string {
  return source
    .replace(BLOCK_TAG_PATTERN, "\n\n$1\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * HTML block-level tag set we recognize when tracking depth. Subset of
 * CommonMark §4.6 type-6 list — only tags creators actually nest. Span /
 * `<message>` / `<narration>` 等 inline 或语义标签**不**算入，否则 ensureBlock
 * Separation 插的空行会被立刻吃掉，反而破坏语义路由。
 */
const BLOCK_TAG_RE =
  /^(div|details|summary|section|article|header|footer|nav|aside|main|table|tbody|thead|tfoot|tr|td|th|ul|ol|li|p|figure|figcaption|blockquote|pre|dl|dt|dd|address|fieldset|form|hr)$/i;

function countBlockOpens(line: string): number {
  let n = 0;
  for (const m of line.matchAll(/<([a-zA-Z][\w-]*)(?:\s[^>]*)?>/g)) {
    if (m[0].endsWith("/>")) continue;
    if (BLOCK_TAG_RE.test(m[1])) n++;
  }
  return n;
}

function countBlockCloses(line: string): number {
  let n = 0;
  for (const m of line.matchAll(/<\/([a-zA-Z][\w-]*)\s*>/g)) {
    if (BLOCK_TAG_RE.test(m[1])) n++;
  }
  return n;
}

/**
 * 进 block-level HTML 之后，把内部空行吃掉、把 ≥1 空格的行首缩进剥掉。
 * Block 起始行（depth 从 0 涨到 ≥1 的那行）本身**不**改 —— 保持 CommonMark
 * type-6 对"行首 ≤3 空格"的要求落在 creator 自己手里。
 *
 * 嵌套深度按"块级开标签数 - 块级闭标签数"逐行累加。<span>/<message>/HTML
 * 注释/自闭合标签等都不计入。深度跌回 0 后下一段恢复正常 markdown 处理。
 */
export function normalizeHtmlBlocks(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  let depth = 0;

  for (const rawLine of lines) {
    let line = rawLine;

    if (depth > 0) {
      if (line.trim() === "") {
        // 折叠空行；标签计数不变，跳过 push
        continue;
      }
      line = line.replace(/^[ \t]+/, "");
    }

    out.push(line);
    depth = Math.max(0, depth + countBlockOpens(line) - countBlockCloses(line));
  }

  return out.join("\n");
}

/**
 * 组合入口：先夯实语义标签的块级分隔，再规整 HTML block 内部。两步顺序不可换
 * —— ensureBlockSeparation 引入的空行需要保留作为段落边界；normalizeHtmlBlocks
 * 只动 div 类 block 内部的空行，不碰外部。
 */
export function prepareForMarkdown(source: string): string {
  return normalizeHtmlBlocks(ensureBlockSeparation(source));
}
