"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { useExploreTransition } from "@/components/explore/ExploreTransition";

/**
 * 探索页搜索框 —— 原来是 GET form 整页导航，现在提交走 transition
 * 导航（旧内容原地保留）。carry 里是要随搜索一起保留的其它筛选参数
 * （tag / excludeTag / sort / view），与原 hidden input 等价。
 */
interface Props {
  defaultValue: string;
  placeholder: string;
  buttonLabel: string;
  carry: Array<[string, string]>;
}

export function ExploreSearchForm({
  defaultValue,
  placeholder,
  buttonLabel,
  carry,
}: Props) {
  const { navigate } = useExploreTransition();
  const [value, setValue] = useState(defaultValue);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    for (const [k, v] of carry) sp.append(k, v);
    const q = value.trim();
    if (q) sp.set("q", q);
    const qs = sp.toString();
    navigate(qs ? `/explore?${qs}` : "/explore");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="explore-search-form flex flex-1 flex-wrap items-center gap-[var(--space-sm)]"
    >
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="explore-search-input min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-md)] py-[var(--space-xs)] text-base text-text-primary outline-none focus:border-border-strong sm:min-w-60"
      />
      <button
        type="submit"
        aria-label={buttonLabel}
        className="explore-search-button shrink-0 px-[var(--space-md)] py-[var(--space-xs)] text-base text-text-muted transition-colors hover:text-text-primary"
      >
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </form>
  );
}
