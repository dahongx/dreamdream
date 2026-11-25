/**
 * 法律文书的结构化模型 —— 用户协议 / 隐私政策共用。
 *
 * 为什么不是 Markdown 字符串：法律文本要跨 4 个语言版本保持**条款编号与
 * 结构完全一致**（第 8.2 条在繁中版和日文版必须指同一件事，否则条款交叉
 * 引用会错位）。结构化数据让 legal-documents.test.ts 能机器校验这件事，
 * Markdown 做不到。
 *
 * 渲染契约见 src/components/legal/LegalDocument.tsx。
 */

/** 段落。`strong` 对应法律惯例里「以粗体标识的免责/限责条款」。 */
export interface LegalParagraph {
  kind: "paragraph";
  text: string;
  strong?: boolean;
}

/** 条目列表。`ordered` 为真时渲染成有序列表。 */
export interface LegalList {
  kind: "list";
  items: string[];
  ordered?: boolean;
}

/** 小节标题（章内的二级标题，不进目录）。 */
export interface LegalSubheading {
  kind: "subheading";
  text: string;
}

/** 高亮提示框 —— 用于「重要提示」「红线承诺」这类需要视觉抬高的段落。 */
export interface LegalNotice {
  kind: "notice";
  title: string;
  items: string[];
}

export type LegalBlock =
  | LegalParagraph
  | LegalList
  | LegalSubheading
  | LegalNotice;

export interface LegalSection {
  /**
   * 稳定锚点 ID —— 跨语言必须一致，既是 URL fragment（/agreement/user#liability）
   * 也是结构测试的对齐键。**一旦发布不要改**，外部引用会断。
   */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  /** 生效日期，各语言按本地习惯书写（繁中「2026 年 7 月 1 日」/ 泰文用佛历 2569）。 */
  effectiveDate: string;
  /** 正文前的引言块（重要提示 / 平台定位 / 签约动作）。 */
  intro: LegalBlock[];
  sections: LegalSection[];
}
