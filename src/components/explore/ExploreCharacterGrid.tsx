"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadMoreCharacters } from "@/app/explore/actions";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { CharacterGridCard } from "@/components/characters/CharacterGridCard";
import type { Dict } from "@/i18n/types";
import type { ExploreListItem, ExploreSort } from "@/lib/characters/queries";

interface ExploreCharacterGridProps {
  initialItems: ExploreListItem[];
  sort: ExploreSort;
  search?: string;
  tag?: string;
  excludeTags?: string[];
  dict: Dict;
}

export function ExploreCharacterGrid({
  initialItems,
  sort,
  search,
  tag,
  excludeTags,
  dict,
}: ExploreCharacterGridProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length === 24);
  const [isPending, startTransition] = useTransition();

  // sentinel + IntersectionObserver：滚到底部前 400px 就悄悄拉下一页，
  // 不再需要点击「加载更多」。ref 存最新的 items/hasMore/isPending
  // 避免 observer 闭包读到过期值（observer 只在 mount 时建一次）。
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef(items);
  const hasMoreRef = useRef(hasMore);
  const isPendingRef = useRef(isPending);
  itemsRef.current = items;
  hasMoreRef.current = hasMore;
  isPendingRef.current = isPending;

  const loadMore = useCallback(() => {
    if (isPendingRef.current || !hasMoreRef.current) return;

    const currentItems = itemsRef.current;
    const lastItem = currentItems[currentItems.length - 1];
    if (!lastItem) return;

    startTransition(async () => {
      const newItems = await loadMoreCharacters({
        sort,
        search,
        tag,
        excludeTags,
        cursor: {
          createdAt: lastItem.createdAt.toISOString(),
          id: lastItem.id,
        },
      });

      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...newItems]);
        setHasMore(newItems.length === 24);
      }
    });
  }, [sort, search, tag, excludeTags]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            loadMore();
            break;
          }
        }
      },
      {
        // 提前 400px 触发，滚到底之前就开始拉，感受更顺滑
        rootMargin: "0px 0px 400px 0px",
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <div className="nj-moonrise-grid grid grid-cols-2 gap-[var(--space-md)] sm:grid-cols-3 lg:grid-cols-4 lg:gap-[var(--space-lg)] xl:grid-cols-5">
        {items.map((c, i) => (
          <CharacterGridCard
            key={c.id}
            character={c}
            dict={dict}
            variant="explore"
            hardNav
            imagePreload={i === 0}
            imageLoading={i < 4 ? "eager" : "lazy"}
          />
        ))}
      </div>

      {hasMore && (
        <div
          ref={sentinelRef}
          className="mt-[var(--space-xl)] flex min-h-[48px] items-center justify-center gap-[var(--space-sm)] text-sm text-text-muted"
          aria-live="polite"
          aria-busy={isPending}
        >
          <BreathingDots />
          {isPending && <span>{dict.explore.loading}</span>}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="mt-[var(--space-xl)] flex justify-center">
          <p className="text-sm text-text-muted">
            {dict.explore.noMoreResults}
          </p>
        </div>
      )}
    </>
  );
}
