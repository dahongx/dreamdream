import type { PropsWithChildren } from "react";

/**
 * <scenario> / <sce> — 仅作 className 钩子的 pass-through 容器。
 * host 不挂默认视觉，留给 creator CSS 接管。
 * 视觉契约见 docs/contracts/chat-render-spec.md §2.4
 */
export function ScenarioSection({ children }: PropsWithChildren) {
  return <div className="nj_scenario_section">{children}</div>;
}
