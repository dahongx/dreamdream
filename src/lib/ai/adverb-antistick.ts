/**
 * Gemini 3.1 Pro 中文副词黏滞退化的入库前清洗。
 *
 * 现象（复现 07-09 谢寻卡 4898e06b-...：一条消息 "极其" 出现 270 次，来自
 * gemini-3.1-pro-preview，finishReason=stop、无 continuation，纯 in-context
 * echo chamber）：多轮把状态栏 HTML 回喂进上下文后，Gemini 会在下一轮生成里
 * 指数级复读某个中文双字副词。Sonnet/Opus 完全没这毛病 —— 07 月 616 条 Sonnet
 * 消息里 "极其" 合计 149 次（平均 < 0.25/条），Gemini 563 条堆了 1918 次、
 * 14 条重度污染（≥20 次）。
 *
 * provider 侧本应用 frequencyPenalty 兜，但当前中转（zhengmi）对 gemini-3-pro
 * 拒收该字段（见 route.ts 附近注释）。所以只能在返回文本落库前做后处理。
 *
 * 策略（保守，只咬明显病态、不干预正常强调）：
 *  1. **连续重复折叠**：同一副词紧接出现 ≥2 次 → 折叠成 1 次
 *     （"极其极其极其" → "极其"）。人类中文几乎不会连写两个同样的双字副词，
 *     词表刻意排除了"很多/慢慢"这类合法叠字。
 *  2. **段内密集删除**：按换行切段，段内同一副词 ≥5 次时，从第 3 次起删除。
 *     "极其温柔，极其小心" 是自然表达（2 次，通过）；一段里刷 5 次以上才动手。
 *
 * 词表限定几个高频强调副词，不覆盖形容词/动词/名词 —— 避免误伤正常创作。
 * 参数 STICKY_ADVERBS 是 const 数组；新增词需评估是否为"双字强调副词"。
 */

const STICKY_ADVERBS = [
  "极其",
  "极度",
  "极为",
  "极端",
  "非常",
  "十分",
  "格外",
  "异常",
  "相当",
  "超级",
  "无比",
  "极致",
] as const;

/**
 * 仅供 gemini-3.1-pro-preview 使用的 system prompt 前置禁令。
 *
 * 治的是「用错语法」，与后处理清洗互补：
 *  - 清洗只压次数，不动搭配 —— "极其极其极其彻底完了" 会被清成 "极其彻底完了"，
 *    但 "极其彻底" 本身就是错搭（"彻底" 已是绝对化，前面加 "极其" 冗余），清洗管不了。
 *  - 这段禁令让模型第一步就少产出这类错搭；配合清洗兜底，用户观感明显干净。
 *
 * 只针对该模型：Sonnet / Opus / DeepSeek 无此毛病，加禁令反而稀释指令预算。
 */
/**
 * 从 assistant 历史消息里剥离状态栏 HTML 块（回喂给模型时用）。
 *
 * 原理：谢寻卡这类 output_setting 强制每轮回复末尾输出 `<details class="status-card">
 * <summary>...</summary>...</details>` 状态栏。这坨 HTML 落库、渲染 UI、创作者调试
 * 都没问题，但下一轮**当历史喂回给模型**时，模型看到自己上轮写的群聊状态栏里
 * 副词错搭 / 复读，下一轮会学着写更多 —— 状态栏是雪球的燃料。
 *
 * 只在**给模型的历史组装阶段**用；DB 里存的原文、前端渲染的 HTML 都不动 ——
 * 用户看到的和 debug 看到的还是完整状态栏，模型看到的是叙事正文。
 *
 * 匹配 `<details class="status-card">...</details>` 以及 `<div class="status-wrapper">
 * ...</div>` 两个变体（外部模板同时用过这两种外壳）。
 */
const STATUS_CARD_RE =
  /<details\b[^>]*class="[^"]*status-card[^"]*"[^>]*>[\s\S]*?<\/details>/gi;

const STATUS_WRAPPER_OPEN_RE =
  /<div\b[^>]*class="[^"]*status-wrapper[^"]*"[^>]*>/gi;
const DIV_TAG_RE = /<\/?div\b[^>]*>/gi;

function stripStatusWrappers(text: string): string {
  let out = text;
  let searchFrom = 0;

  while (searchFrom < out.length) {
    STATUS_WRAPPER_OPEN_RE.lastIndex = searchFrom;
    const opening = STATUS_WRAPPER_OPEN_RE.exec(out);
    if (!opening) break;

    const tags = new RegExp(DIV_TAG_RE.source, "gi");
    tags.lastIndex = opening.index + opening[0].length;
    let depth = 1;
    let end = out.length;
    for (;;) {
      const tag = tags.exec(out);
      if (!tag) break;
      if (tag[0].startsWith("</")) depth--;
      else depth++;
      if (depth === 0) {
        end = tags.lastIndex;
        break;
      }
    }

    out = `${out.slice(0, opening.index)}${out.slice(end)}`;
    searchFrom = opening.index;
  }

  return out;
}

export function stripStatusCards(text: string): string {
  if (!text) return text;
  // wrapper 必须先按 div 层级整块剥离；否则先删内部 status-card 会留下空壳。
  // 层级扫描也避免旧的贪婪正则误删 wrapper 后面的普通 div。
  let out = stripStatusWrappers(text);
  out = out.replace(STATUS_CARD_RE, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function geminiAntiStickPromptSection(modelId: string): string {
  if (modelId !== "gemini-3.1-pro-preview") return "";
  return [
    "### 用词约束（严格遵守）",
    "在中文创作中：",
    "1. 严禁在同一段文字里对同一个程度副词（极其/非常/十分/极度/格外/异常/相当/超级/无比）连续或密集使用；同一段最多出现 2 次。",
    "2. 严禁用程度副词修饰已表绝对化含义的形容词：如「彻底」「完全」「所有」「全部」「死死」「干净」「空」「透」「死」等 —— 不写「极其彻底」「非常完全」「极其干净」。",
    "3. 严禁用程度副词修饰动词：如「发话」「说」「看」「走」「笑」等 —— 不写「极其发话」「非常说」「十分看着」。程度副词只修饰形容词或状态。",
    "4. 需要强调时，用具体描写替代副词堆砌（如「声音低得几乎听不见」替代「极其小声」）。",
  ].join("\n");
}

/** 全文所有词的出现次数汇总，用于污染阈值判定与日志。 */
export function countStickyAdverbs(text: string): number {
  if (!text) return 0;
  let total = 0;
  for (const w of STICKY_ADVERBS) {
    // 简单计数：全文子串出现次数
    let idx = text.indexOf(w);
    while (idx !== -1) {
      total++;
      idx = text.indexOf(w, idx + w.length);
    }
  }
  return total;
}

/** 规则 1：把 "极其极其极其..." 这种 ≥2 次连续同词折叠为 1 次。 */
function collapseConsecutive(text: string): string {
  let out = text;
  for (const w of STICKY_ADVERBS) {
    // 匹配 w 紧接重复 ≥2 次（含首个 w，共 ≥2 次），全部替换为单个 w
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:${escaped}){2,}`, "g");
    out = out.replace(re, w);
  }
  return out;
}

/** 规则 2：按行切段，段内同一副词 ≥5 次时，从第 3 次起删除。 */
function thinDensePerLine(text: string): string {
  const lines = text.split("\n");
  const escapedList = STICKY_ADVERBS.map((w) => ({
    w,
    re: new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
  }));

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (const { w, re } of escapedList) {
      // 快速跳过：段内不足 5 次不动
      let count = 0;
      re.lastIndex = 0;
      while (re.exec(line) !== null) count++;
      if (count < 5) continue;

      // 保留前 2 次、删除后续
      let seen = 0;
      re.lastIndex = 0;
      line = line.replace(re, () => {
        seen++;
        return seen <= 2 ? w : "";
      });
    }
    lines[i] = line;
  }
  return lines.join("\n");
}

export interface AntiStickResult {
  text: string;
  originalCount: number;
  cleanedCount: number;
  changed: boolean;
}

/**
 * 主入口：只对 Gemini 3.1 Pro 生效的清洗管线。
 * 返回清洗后文本 + 前后计数（供 route 层判断是否打 pollution log）。
 */
export function antiStickAdverbs(text: string): AntiStickResult {
  if (!text) {
    return { text, originalCount: 0, cleanedCount: 0, changed: false };
  }
  const originalCount = countStickyAdverbs(text);
  if (originalCount === 0) {
    return { text, originalCount: 0, cleanedCount: 0, changed: false };
  }
  const step1 = collapseConsecutive(text);
  const step2 = thinDensePerLine(step1);
  const cleanedCount = countStickyAdverbs(step2);
  return {
    text: step2,
    originalCount,
    cleanedCount,
    changed: step2 !== text,
  };
}

/** 判定是否达到"污染"阈值，供 route 层打 log 用。绝对次数或密度任一达标即触发。 */
export function isPollutedByAdverbs(
  text: string,
  count = countStickyAdverbs(text),
): boolean {
  if (count >= 15) return true;
  // 密度阈值：每 200 字符出现 1 次以上（避免短文本被误判）
  if (text.length >= 400 && count / (text.length / 200) >= 1) return true;
  return false;
}
