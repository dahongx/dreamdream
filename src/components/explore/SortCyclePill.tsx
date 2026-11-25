"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useExploreTransition } from "@/components/explore/ExploreTransition";
import type { ExploreSort } from "@/lib/characters/queries";

interface SortOption {
  value: ExploreSort;
  label: string;
}

interface Props {
  value: ExploreSort;
  options: SortOption[];
  ariaLabel: string;
}

export function SortCyclePill({ value, options, ariaLabel }: Props) {
  const { navigate } = useExploreTransition();
  const pathname = usePathname();
  const params = useSearchParams();

  const currentIndex = options.findIndex((option) => option.value === value);
  const current = options[currentIndex] ?? options[0];
  const next = options[(currentIndex + 1) % options.length] ?? options[0];

  function buildHref(nextValue: ExploreSort): string {
    const sp = new URLSearchParams(params.toString());
    if (nextValue === "recommended") sp.delete("sort");
    else sp.set("sort", nextValue);
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function onClick() {
    navigate(buildHref(next.value));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${ariaLabel}: ${current.label}`}
      className="explore-recommend-pill"
    >
      <span>{current.label}</span>
      <span aria-hidden="true">✦</span>
    </button>
  );
}
