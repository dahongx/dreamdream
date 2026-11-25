"use client";

import { memo, useContext, useMemo } from "react";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { MufySharedComponentStyleContext, MufyOriginalTitleFontContext } from "./mufy-shared-component-context";
import Markdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";
import { protectMufyPublicParagraphLf, rehypeRestoreMufyPublicParagraphLf } from "@/lib/mufy-public-paragraph-lf";
import { prepareForMarkdown } from "@/lib/markdown-prep";
import { type SanitizeOptions, sanitizeHtml } from "@/lib/sanitize";
import { needsMufyLightTableRows } from "@/lib/import/mufy-native-table";
import { rehypeBindMufyOpeningPlayerName } from "@/lib/import/mufy-player-name";
import mufyTableStyles from "./mufy-native-table.module.css";
import { AIBubble } from "./messages/AIBubble";
import { ArtifactIframe } from "./messages/ArtifactIframe";
import { EmphasisText } from "./messages/EmphasisText";
import { Narration } from "./messages/Narration";
import { ScenarioSection } from "./messages/ScenarioSection";
import { SystemCapsule } from "./messages/SystemCapsule";
import { ThinkBlock } from "./messages/ThinkBlock";
import { UserBubbleFromTag } from "./messages/UserBubbleFromTag";

/**
 * 聊天消息渲染器（Layer A 输入合约的渲染端）。
 *
 * 接收一段消息体 HTML/markdown string（可能来自 LLM 流式输出 / 已经 applyRegex
 * 之后的 html segment / studio preview 测试样本）→ sanitize → react-markdown
 * + rehype-raw → 通过 components map 把语义标签路由到对应组件。
 *
 * 视觉契约：docs/contracts/chat-render-spec.md §2.3 §2.4
 *
 * 三处必须共用同一个 renderer 以保证 preview 真实度：
 *   - src/components/chat/MessageBubble.tsx          （生产）
 *   - src/components/regex/RegexForm.tsx             （regex studio test panel）
 *   - src/components/packs/studio/PreviewCanvas.tsx  （pack studio preview）
 *
 * ```html / ```svg / ```mermaid / ```markmap code block 走 ArtifactIframe，
 * 其他 code block 走 .nj_code_block。详见 spec §3.8
 *
 * remark-breaks：把「段落内单换行」渲染成 <br>，对齐「软换行即断行」的
 * 行为。CommonMark 默认把段内单个 \n 折叠成空格（只有空行才分段），导致创作者
 * 靠单换行分行的纯文本状态栏（━━ / Time: / Loc: / Char: / ━━）在聊天页被挤成
 * 一行。remark-breaks 只作用于 markdown 段落里的字面换行 —— HTML block（div/
 * details）内部、code fence、语义标签均不受影响（已实证）。
 */

interface CodeProps {
  children?: React.ReactNode;
  className?: string;
  inline?: boolean;
  artifactMinHeight?: number;
  mufySourceDefaults?: boolean;
}

const ARTIFACT_LANGS = new Set(["html", "svg", "mermaid", "markmap"]);

function CodeOrArtifact({ children, className, inline, artifactMinHeight, mufySourceDefaults }: CodeProps) {
  const lang = /language-(\w+)/.exec(className ?? "")?.[1];
  if (inline) {
    return <code className={className}>{children}</code>;
  }
  if (lang && ARTIFACT_LANGS.has(lang)) {
    // react-markdown may call this renderer for an empty fenced block without
    // children. String(undefined) used to turn that into a 240px iframe whose
    // entire visible body was the literal word "undefined".
    const source = Array.isArray(children)
      ? children
          .filter((child): child is string => typeof child === "string")
          .join("")
      : typeof children === "string"
        ? children
        : "";
    if (!source.trim()) return null;
    return <ArtifactIframe srcdoc={source} minHeight={artifactMinHeight} mufySourceDefaults={mufySourceDefaults} />;
  }
  return (
    <pre className="nj_code_block">
      <code className={className}>{children}</code>
    </pre>
  );
}

/**
 * react-markdown 的 Components 类型只允许标准 HTML 标签作为 key。我们路由的
 * 是 LLM 协议自定义标签（message/narration/system/...），必须 cast 一次。
 * 这层 cast 是 host 协议契约的边界 —— 标签集合在 sanitize.ts SEMANTIC_TAGS
 * 已经显式收口，不会有未声明标签溜进 components map。
 */
const SEMANTIC_COMPONENTS = {
  message: AIBubble,
  mes: AIBubble,
  user: UserBubbleFromTag,
  usr: UserBubbleFromTag,
  narration: Narration,
  nar: Narration,
  system: SystemCapsule,
  sys: SystemCapsule,
  scenario: ScenarioSection,
  sce: ScenarioSection,
  think: ThinkBlock,
  artifact: ArtifactIframe,
  strong: EmphasisText,
  code: CodeOrArtifact,
} as unknown as Components;

function MufyCodeOrArtifact(props: CodeProps) {
  return <CodeOrArtifact {...props} artifactMinHeight={1} mufySourceDefaults />;
}

function MufyArtifact(props: React.PropsWithChildren) {
  return <ArtifactIframe {...props} minHeight={1} mufySourceDefaults />;
}

const MUFY_COMPONENTS: Components = {
  ...SEMANTIC_COMPONENTS,
  code: MufyCodeOrArtifact,
  ...({ artifact: MufyArtifact } as unknown as Components),
  table: ({ node: _node, className, style, ...props }) => (
    <table {...props} style={style} className={[
      className,
      needsMufyLightTableRows(style) ? mufyTableStyles.sourceLightRows : undefined,
    ].filter(Boolean).join(" ") || undefined} />
  ),
};

interface Props {
  /** 已经做过 regex transform 的 HTML 片段（或 plain markdown / LLM 半结构化输出）。 */
  source: string;
  /** 透传给 sanitize 的 options（如 allowStyle）。 */
  sanitizeOpts?: SanitizeOptions;
  /** Public source-platform defaults only, not arbitrary author CSS. */
  mufySourceDefaults?: boolean;
  /** Source platform repeats the role avatar beside speech, unlike native Dearm. */
  mufyAvatar?: { src: string | null; name: string };
  mufyOpeningPlayerName?: string;
}

// memo：react-markdown 每次 render 都要跑完整 parse 管线（rehype-raw + 组件
// 路由），对长消息是毫秒级 CPU。source 不变时整棵子树跳过 —— 这是聊天页
// 流式期间历史气泡不被拖垮的最后一道闸。
export const MessageRenderer = memo(function MessageRenderer({
  source,
  sanitizeOpts,
  mufySourceDefaults = false,
  mufyAvatar,
  mufyOpeningPlayerName,
}: Props) {
  const publicParagraphLf = useMemo(
    () => protectMufyPublicParagraphLf(source, mufySourceDefaults),
    [source, mufySourceDefaults],
  );
  const safe = useMemo(
    () => sanitizeHtml(prepareForMarkdown(publicParagraphLf.source), sanitizeOpts),
    [publicParagraphLf.source, sanitizeOpts],
  );
  const rehypePlugins = useMemo(
    () => [
      rehypeRaw,
      rehypeRestoreMufyPublicParagraphLf(publicParagraphLf.token),
      ...(mufySourceDefaults && mufyOpeningPlayerName
        ? [rehypeBindMufyOpeningPlayerName(mufyOpeningPlayerName)]
        : []),
    ],
    [publicParagraphLf.token, mufySourceDefaults, mufyOpeningPlayerName],
  );
  const sharedStyle=useContext(MufySharedComponentStyleContext);
  const originalTitleFont=useContext(MufyOriginalTitleFontContext);
  const nativeStyle=useMemo(()=>mufySourceDefaults&&sharedStyle?sanitizeAndScopeCss(sharedStyle,'mufy-native-message').css:'',[mufySourceDefaults,sharedStyle]);
  const components=useMemo(() => {
    if(!mufySourceDefaults)return SEMANTIC_COMPONENTS;
    if(!mufyAvatar?.src)return MUFY_COMPONENTS;
    const Speech=({children}:React.PropsWithChildren)=>(<div className={mufyTableStyles.speechRow}>
      {/* Source-platform avatar, not a change to Dearm's native speech contract. */}
      <img src={mufyAvatar.src!} alt={mufyAvatar.name} className={mufyTableStyles.speechAvatar}/>
      <AIBubble>{children}</AIBubble>
    </div>);
    return {...MUFY_COMPONENTS,message:Speech,mes:Speech} as unknown as Components;
  },[mufySourceDefaults,mufyAvatar?.src,mufyAvatar?.name]);
  const content=(
    <Markdown
      remarkPlugins={[remarkBreaks]}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {safe}
    </Markdown>
  );
  // ReactMarkdown emits siblings. As direct flex items, an author's margin:auto
  // wrapper shrink-wraps while a sibling details stretches. Restore the source
  // block formatting context, rather than forcing a text-align on every fold.
  return mufySourceDefaults ? (
    <div className={[mufyTableStyles.nativeSource,/\.(?:mf-fire-widget|right-stable-sidebar)/.test(sharedStyle)?mufyTableStyles.withViewportSidebar:undefined].filter(Boolean).join(' ')} data-character-css="mufy-native-message" data-mufy-original-title-font={originalTitleFont?'qie-51271b':undefined}>
      {nativeStyle&&<style>{nativeStyle}</style>}
      {content}
    </div>
  ) : content;
});
