import { describe, expect, test } from "bun:test";
import { isValidElement } from "react";
import { OpeningErrorBoundary } from "../OpeningErrorBoundary";

/**
 * Error Boundary 契约测试（纯逻辑，不依赖 DOM 渲染）。
 *
 * 验证 React Error Boundary 的状态机：
 *   - getDerivedStateFromError 把 hasError 置 true（崩溃→进兜底态）
 *   - render 在 hasError=true 时返回 fallback、false 时透传 children
 *
 * 这保证「子树崩溃只降级这一块、不连累详情页其余部分」的核心行为。
 * 端到端的真实 hydration 隔离由部署后的浏览器验证覆盖。
 */
describe("OpeningErrorBoundary", () => {
  test("getDerivedStateFromError 进入兜底态", () => {
    const next = OpeningErrorBoundary.getDerivedStateFromError();
    expect(next.hasError).toBe(true);
  });

  test("正常态(hasError=false)透传 children", () => {
    const child = "正常美化内容" as unknown as React.ReactNode;
    const eb = new OpeningErrorBoundary({
      children: child,
      fallbackLabel: "加载失败提示",
    });
    eb.state = { hasError: false };
    const out = eb.render();
    // 透传：渲染结果就是 children 本身，不包兜底壳
    expect(out).toBe(child);
  });

  test("崩溃态(hasError=true)渲染兜底提示，不透传 children", () => {
    const eb = new OpeningErrorBoundary({
      children: "本应崩溃的内容" as unknown as React.ReactNode,
      fallbackLabel: "加载失败提示",
    });
    eb.state = { hasError: true };
    const out = eb.render();
    // 兜底：渲染一个 React 元素（div），且不是原 children
    expect(isValidElement(out)).toBe(true);
    expect(out).not.toBe("本应崩溃的内容");
  });

  test("崩溃态使用传入的 fallbackLabel 文案", () => {
    const eb = new OpeningErrorBoundary({
      children: null,
      fallbackLabel: "自定义兜底文案",
    });
    eb.state = { hasError: true };
    const out = eb.render() as React.ReactElement<{
      children: React.ReactNode;
    }>;
    expect(out.props.children).toBe("自定义兜底文案");
  });
});
