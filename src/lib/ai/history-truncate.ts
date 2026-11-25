import type { ModelMessage } from "ai";

/**
 * 会话历史滑窗截断（量化滞回版）。
 *
 * 目的一（内存）：防止 8G 机器上 3 并发 300K+ token 请求把 Node 堆打爆
 * （2026-07-04 / 07-05 两次卡机事故根因）。Gemini 3.1 pro 支持 2M token 不代表
 * 我们负担得起——单请求 300K token JSON 序列化 + SSE buffer + V8 heap 峰值就能
 * 吃满几百 MB，三个并发直接顶穿 8G RAM。
 *
 * 目的二（cache）：provider 的 prompt cache（Anthropic cacheControl / Gemini、
 * OpenAI 隐式前缀缓存）都要求 messages 前缀逐字节稳定。旧版「从最新往回累加、
 * 贴着预算截」会让窗口起点每轮漂移一两条 → 每轮全量 cache miss，超长会话的
 * input token 费用直接翻数倍。
 *
 * 策略（无状态、确定性，不引入 tiktoken 依赖，不需要持久化游标）：
 *   1. 总字符 ≤ CHAR_BUDGET：全量保留，什么都不动。
 *   2. 超预算后，把「从头部丢弃的字符量」量化到 TRUNC_STEP 的整数倍：
 *        dropTarget = STEP * ceil((total - BUDGET) / STEP)
 *      历史是 append-only 的，旧消息的前缀字符和不变，所以 total 在同一档
 *      （宽 STEP）内增长时 dropTarget 不变 → 丢弃的消息集合不变 → 窗口起点
 *      稳定不动，cache 持续命中；跨档时起点一次性前移 ~STEP 字符（默认
 *      100K ≈ 几十轮），只付一次 cache miss。
 *      保留量在 (BUDGET - STEP, BUDGET] 之间锯齿波动，内存上限仍是 BUDGET。
 *   3. 至少保留最新 MIN_KEEP 条，避免上下文过短失去连贯性（单条消息特大的
 *      病态场景下触发，此时不保证窗口稳定）。
 *   4. 若首条是 assistant（角色卡开场白 opening），**永远保留**——角色人设
 *      主要靠 opening 建立，砍了模型立刻崩人设。
 *   5. 截后确保正文首条是 user，避免 assistant/assistant 连续。
 *
 * 稳定性依赖 append-only：改写/删除**历史早段**消息会移动前缀字符和，导致
 * 窗口起点变化、一次性 cache miss（可接受）；重写最新一条（regenerate）只动
 * 尾部，不影响窗口起点。
 *
 * 由 env var 可调：CHAT_HISTORY_CHAR_LIMIT（预算，默认 300K）、
 * CHAT_HISTORY_MIN_KEEP（保底条数，默认 20）、CHAT_HISTORY_TRUNC_STEP
 * （量化步长，默认预算的 1/3）。
 */

const DEFAULT_CHAR_BUDGET = 300_000; // 约 100K token 上限（保守估）
const DEFAULT_MIN_KEEP = 20; // 最少保留最新 20 条

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 估算一条 ModelMessage 的字符体积（不含结构 overhead，只算 text）。 */
function estimateChars(m: ModelMessage): number {
  const c = m.content as unknown;
  if (typeof c === "string") return c.length;
  if (Array.isArray(c)) {
    let total = 0;
    for (const part of c) {
      const p = part as { type?: string; text?: string };
      if (p.type === "text" && typeof p.text === "string") {
        total += p.text.length;
      } else {
        // 图片 / tool-call / reasoning 等非文本 part 按 100 char 记账
        total += 100;
      }
    }
    return total;
  }
  return 0;
}

export interface TruncateResult {
  messages: ModelMessage[];
  original: number;
  kept: number;
  charsKept: number;
  truncated: boolean;
}

export function truncateHistory(messages: ModelMessage[]): TruncateResult {
  const budget = envInt("CHAT_HISTORY_CHAR_LIMIT", DEFAULT_CHAR_BUDGET);
  const minKeep = envInt("CHAT_HISTORY_MIN_KEEP", DEFAULT_MIN_KEEP);
  const step = envInt(
    "CHAT_HISTORY_TRUNC_STEP",
    Math.max(1, Math.floor(budget / 3)),
  );
  const original = messages.length;

  // opening（首条 assistant）单独保留，不进滑窗预算
  const hasOpening = messages[0]?.role === "assistant";
  const opening = hasOpening ? messages[0] : null;
  const body = hasOpening ? messages.slice(1) : messages;

  const sizes = body.map(estimateChars);
  const total = sizes.reduce((a, b) => a + b, 0);

  // cut = body 中从头丢弃的条数
  let cut = 0;
  if (total > budget) {
    const dropTarget = step * Math.ceil((total - budget) / step);
    let dropped = 0;
    while (cut < body.length && dropped < dropTarget) {
      dropped += sizes[cut];
      cut++;
    }
  }

  // 保底最新 minKeep 条（允许超预算，与旧行为一致）
  if (body.length - cut < minKeep) {
    cut = Math.max(0, body.length - minKeep);
  }

  // 截后正文首条必须是 user，否则与 opening 形成 assistant/assistant 连续
  while (cut < body.length && body[cut].role === "assistant") {
    cut++;
  }

  const keptBody = body.slice(cut);
  const result = opening ? [opening, ...keptBody] : keptBody;
  const truncated = result.length < original;

  let charsKept = opening ? estimateChars(opening) : 0;
  for (let i = cut; i < body.length; i++) charsKept += sizes[i];

  return {
    messages: result,
    original,
    kept: result.length,
    charsKept,
    truncated,
  };
}
