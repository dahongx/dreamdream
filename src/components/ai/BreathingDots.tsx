/**
 * 三个错峰呼吸点（无文案）—— DESIGN.md「加载不用通用 spinner」的最小
 * 复用单元，给按钮内 / 行内等紧凑场景用。带文案的独立行场景用
 * ThinkingDots。
 *
 * .ai-loading-dot 是未分层规则（自带 accent 紫底 + 8px），Tailwind
 * utility 压不过它，所以 onAccent / size 走 inline style 覆盖。
 */

interface Props {
  /** 深色 accent 底上使用（点改用 --text-on-accent 色） */
  onAccent?: boolean;
  /** 点的直径 px，默认 8（与 .ai-loading-dot 一致） */
  size?: number;
  /** "creative" = AI 创作场景（fuchsia，DESIGN.md 双 accent 身份） */
  tone?: "default" | "creative";
}

export function BreathingDots({
  onAccent = false,
  size,
  tone = "default",
}: Props) {
  const style: React.CSSProperties = {};
  if (onAccent) style.background = "var(--text-on-accent)";
  if (size !== undefined) {
    style.width = size;
    style.height = size;
  }

  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className={`ai-loading-dot${tone === "creative" ? " ai-loading-dot-creative" : ""}`}
          style={{ ...style, animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}
