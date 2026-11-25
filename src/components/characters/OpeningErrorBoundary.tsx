"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * 小剧场/开场组件的崩溃兜底。
 *
 * 背景：opening_components 是 creator 粘进来的任意 HTML 美化内容（平台零审核）。
 * 个别坏卡的内容会在渲染/hydration 阶段抛错——例如作者 CSS 注释手滑混进
 * <think></think> 触发 React hydration #418（见 lib/opening/content.ts 的
 * STRONG_HTML_COMPONENT_RE 修复）。这类崩溃若不隔离，会让 React 放弃整棵子树，
 * 拖垮整个详情页（划不动、编辑/删除点不了）。
 *
 * 本边界只包小剧场区块：正常时**完全透明**（原样渲染美化，零影响）；仅当子树
 * 渲染抛错时介入，把那一块替换成一行降级提示，**详情页其余部分照常可用**。
 *
 * 只能兜「渲染期抛错」类崩溃（含 hydration error）。兜不住死循环 / 纯 CSS 视觉
 * 问题——那类不抛错，Error Boundary 感知不到。
 */
interface Props {
  children: ReactNode;
  /** 降级提示文案由调用方按当前 locale 传入。 */
  fallbackLabel: string;
}

interface State {
  hasError: boolean;
}

export class OpeningErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 留一条 console 方便排查是哪张卡的开场组件崩了；不上报、不阻断。
    console.error(
      "[opening] reel render crashed, isolated by boundary",
      error,
      info,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/40 px-[var(--space-md)] py-[var(--space-md)] text-center text-sm text-text-muted">
          {this.props.fallbackLabel}
        </div>
      );
    }
    return this.props.children;
  }
}
