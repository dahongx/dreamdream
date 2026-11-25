"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";

/**
 * 探索页筛选的 client 过渡层。
 *
 * 之前所有筛选（排序 / 搜索 / tag / 屏蔽 / tab）都是整页 GET 导航：
 * 每次点击整个内容区被 loading 骨架替换再重建，页面骨骼反复消失。
 * 现在筛选导航包进 useTransition —— React 在新 RSC 载荷就绪前保留旧
 * 内容（不触发 loading 边界），pending 期间网格变暗 + 呼吸点，筛选行
 * 保持可交互。URL 仍然是唯一真相（可分享 / 可后退）。
 *
 * loading.tsx 保留：跨路由首次进入 explore 时仍走骨架。
 */

interface TransitionCtx {
  navigate: (href: string) => void;
  pending: boolean;
}

const Ctx = createContext<TransitionCtx | null>(null);

export function useExploreTransition(): TransitionCtx {
  const ctx = useContext(Ctx);
  const router = useRouter();
  // Provider 之外使用时退化为普通导航（组件在别处复用不炸）
  const fallback = useMemo<TransitionCtx>(
    () => ({
      navigate: (href: string) => router.push(href, { scroll: false }),
      pending: false,
    }),
    [router],
  );
  return ctx ?? fallback;
}

export function ExploreTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );
  const value = useMemo(() => ({ navigate, pending }), [navigate, pending]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 筛选链接：外观是 <a>（可中键/新标签），点击走 transition 导航。 */
export function TransitionLink({
  href,
  className,
  children,
  ariaCurrent,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaCurrent?: "page";
}) {
  const { navigate } = useExploreTransition();
  return (
    <a
      href={href}
      aria-current={ariaCurrent}
      className={className}
      onClick={(e) => {
        // 修饰键/中键交给浏览器（新标签等原生行为）
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
          return;
        e.preventDefault();
        const target = new URL(href, window.location.href);
        if (
          target.pathname === window.location.pathname &&
          target.search === window.location.search
        ) {
          return;
        }
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}

/** 结果区包裹：pending 时变暗 + 中央呼吸点，旧内容原地保留。 */
export function ExplorePendingRegion({ children }: { children: ReactNode }) {
  const { pending } = useExploreTransition();
  return (
    <div className="relative">
      <div
        aria-busy={pending}
        className={`transition-opacity duration-[var(--dur-short)] ${
          pending ? "pointer-events-none opacity-50" : "opacity-100"
        }`}
      >
        {children}
      </div>
      {pending && (
        <div className="absolute inset-x-0 top-[15vh] flex justify-center">
          <BreathingDots />
        </div>
      )}
    </div>
  );
}
