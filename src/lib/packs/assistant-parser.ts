/**
 * Pack studio assistant message parser.
 *
 * LLM 输出协议（见 prompts/pack-assistant.txt）：散文 + 一个或多个
 * <proposal type="add-rule">{JSON}</proposal> 或
 * <proposal type="set-global-css">{CSS}</proposal> 块。
 *
 * 解析器把消息切成 text / proposal 段，client 渲染时散文走 markdown，
 * proposal 走 ProposalCard。流式过程中末尾若是未闭合的 <proposal>，
 * 整块暂时藏起来（避免裸露的 raw 标签 + 等闭合后再 rerender）。
 */

export interface ProposalAddRule {
  type: "add-rule";
  name: string;
  /** Creator-first 一句话说明：「这是什么样的组件 + 什么时候出现」。
   *  ProposalCard 默认展开，pattern / replacement 这些技术字段默认折叠。 */
  description?: string;
  targetText?: string | null;
  pattern: string;
  replacement: string;
  variableMapping?: Array<{ index: number; name: string; sample?: string }>;
  outputGuidance?: string | null;
  visible?: boolean;
  enabled?: boolean;
}

export interface ProposalSetGlobalCss {
  type: "set-global-css";
  css: string;
}

export interface ProposalAddOpening {
  type: "add-opening";
  name: string;
  /** Creator-first 一句话说明：「这个开场组件是什么」。 */
  description?: string;
  /** 自包含 HTML，或 <artifact>…</artifact> 交互组件。静态，无捕获组。 */
  content: string;
}

export type AssistantSegment =
  | { kind: "text"; content: string }
  | { kind: "proposal-add-rule"; index: number; payload: ProposalAddRule }
  | {
      kind: "proposal-set-global-css";
      index: number;
      payload: ProposalSetGlobalCss;
    }
  | {
      kind: "proposal-add-opening";
      index: number;
      payload: ProposalAddOpening;
    }
  | { kind: "proposal-error"; index: number; type: string; error: string };

const PROPOSAL_RE = /<proposal\s+type="([^"]+)">([\s\S]*?)<\/proposal>/g;
const PARTIAL_PROPOSAL_RE = /<proposal\s+type="[^>]*$/;

export function parseAssistantMessage(content: string): AssistantSegment[] {
  const segments: AssistantSegment[] = [];
  let cursor = 0;
  let proposalIndex = 0;

  for (const match of content.matchAll(PROPOSAL_RE)) {
    const idx = match.index ?? 0;
    if (idx > cursor) {
      const text = content.slice(cursor, idx);
      if (text.trim()) segments.push({ kind: "text", content: text });
    }
    const type = match[1];
    const body = match[2].trim();
    segments.push(parseProposalBody(proposalIndex, type, body));
    proposalIndex += 1;
    cursor = idx + match[0].length;
  }

  if (cursor < content.length) {
    let trailing = content.slice(cursor);
    // Hide an unclosed <proposal ...> at the streaming tail so creators
    // don't see raw tag markup flicker.
    trailing = trailing.replace(PARTIAL_PROPOSAL_RE, "");
    if (trailing.trim()) {
      segments.push({ kind: "text", content: trailing });
    }
  }

  return segments;
}

function parseProposalBody(
  index: number,
  type: string,
  body: string,
): AssistantSegment {
  if (type === "set-global-css") {
    return {
      kind: "proposal-set-global-css",
      index,
      payload: { type: "set-global-css", css: body },
    };
  }
  if (type === "add-opening") {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (
        typeof parsed.name !== "string" ||
        typeof parsed.content !== "string"
      ) {
        return {
          kind: "proposal-error",
          index,
          type,
          error: "add-opening 至少需要 name + content 字段",
        };
      }
      return {
        kind: "proposal-add-opening",
        index,
        payload: {
          type: "add-opening",
          name: parsed.name as string,
          description: (parsed.description as string) ?? undefined,
          content: parsed.content as string,
        },
      };
    } catch (err) {
      return {
        kind: "proposal-error",
        index,
        type,
        error: `add-opening JSON 解析失败: ${(err as Error).message}`,
      };
    }
  }
  if (type === "add-rule") {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (
        typeof parsed.name !== "string" ||
        typeof parsed.pattern !== "string"
      ) {
        return {
          kind: "proposal-error",
          index,
          type,
          error: "add-rule 至少需要 name + pattern 字段",
        };
      }
      const payload: ProposalAddRule = {
        type: "add-rule",
        name: parsed.name as string,
        description: (parsed.description as string) ?? undefined,
        pattern: parsed.pattern as string,
        replacement: (parsed.replacement as string) ?? "",
        targetText: (parsed.targetText as string | null) ?? null,
        variableMapping:
          (parsed.variableMapping as ProposalAddRule["variableMapping"]) ?? [],
        outputGuidance: (parsed.outputGuidance as string | null) ?? null,
        visible: (parsed.visible as boolean) ?? false,
        enabled: (parsed.enabled as boolean) ?? true,
      };
      return { kind: "proposal-add-rule", index, payload };
    } catch (err) {
      return {
        kind: "proposal-error",
        index,
        type,
        error: `add-rule JSON 解析失败: ${(err as Error).message}`,
      };
    }
  }
  return {
    kind: "proposal-error",
    index,
    type,
    error: `未知 proposal 类型: ${type}`,
  };
}
