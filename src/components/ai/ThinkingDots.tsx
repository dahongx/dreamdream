/**
 * LLM 推理空窗期占位动画：三个呼吸点 + 一行文案。
 *
 * 在 chat / AI Studio assistant / AIGenerateButton 三处复用。CSS keyframe
 * `nj-breathing` 定义在 globals.css。
 *
 * align:
 *   row    独立一行，给 chat 列表底部 / studio 助手列表底部用
 *   bubble 紧凑居中，给 AIGenerateButton modal 输出空白时占位用
 */

interface Props {
  label: string;
  align?: "row" | "bubble";
  /** "creative" = AI 创作场景（fuchsia 呼吸点，见 .ai-loading-dot-creative） */
  tone?: "default" | "creative";
}

export function ThinkingDots({
  label,
  align = "row",
  tone = "default",
}: Props) {
  const wrapClass =
    align === "bubble"
      ? "flex items-center justify-center gap-[var(--space-sm)] py-[var(--space-md)] text-xs text-text-muted"
      : "flex items-center gap-[var(--space-sm)] text-xs text-text-muted";

  return (
    <div aria-live="polite" className={wrapClass}>
      <span className="flex items-center gap-[3px]">
        {[0, 0.4, 0.8].map((delay) => (
          <span
            key={delay}
            className={`ai-loading-dot${tone === "creative" ? " ai-loading-dot-creative" : ""}`}
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
