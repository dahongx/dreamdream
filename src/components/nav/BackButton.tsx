"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface Props {
  label: string;
  fallbackHref: string;
}

/**
 * 通用「返回上一页」按钮 —— 优先 router.back()，无 history 时回退到指定路由。
 *
 * 用法：服务端页面（RSC）直接渲染本组件即可，无需自己挂 "use client"。
 */
export function BackButton({ label, fallbackHref }: Props) {
  const router = useRouter();
  const onClick = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [router, fallbackHref]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-[var(--space-xs)] text-sm text-text-secondary transition-colors hover:text-text-primary"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
