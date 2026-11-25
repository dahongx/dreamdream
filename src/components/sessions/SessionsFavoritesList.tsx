"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Search, StarOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/i18n/client";
import { localizeCharacterTag } from "@/lib/characters/tags";
import { toggleCharacterFavoriteAction } from "@/lib/favorites/actions";
import type { FavoritedCharacterListItem } from "@/lib/favorites/queries";
import { firstChar } from "@/lib/util/first-char";
import { previewSnippet } from "@/lib/util/preview-text";

/**
 * 「我的收藏」列表 —— 参考 /tmp/page/11.jpg:
 *   - 顶部两个胶囊「全部收藏 / 收藏夹」(收藏夹 v1 占位,点击 toast,不实际切换)
 *   - 搜索框「筛选收藏」—— client 端 substring 过滤,server 数据一次拉好
 *   - 每张卡片:头像 / 角色名 / tags(右上)/ 最新对话预览(无对话时 fallback)
 *
 * client component 因为搜索框需要交互;数据由 server 通过 props 注入,
 * 不在 client 里再 fetch。
 */

interface Props {
  items: FavoritedCharacterListItem[];
  filterAllLabel: string;
  filterFolderLabel: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
  previewUnavailable: string;
  inaccessibleHint: string;
  moreMenuAria: string;
  unfavoriteLabel: string;
  unfavoriteError: string;
}

export function SessionsFavoritesList({
  items,
  filterAllLabel,
  filterFolderLabel,
  searchPlaceholder,
  emptyTitle,
  emptyHint,
  previewUnavailable,
  inaccessibleHint,
  moreMenuAria,
  unfavoriteLabel,
  unfavoriteError,
}: Props) {
  const { dict } = useI18n();
  const [search, setSearch] = useState("");
  // 本地隐藏集合 —— 取消收藏点击后立即视觉移除,server 端 revalidatePath
  // 兜底刷新真实数据。
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-[var(--space-md)]">
        <FilterPills
          filterAllLabel={filterAllLabel}
          filterFolderLabel={filterFolderLabel}
        />
        <EmptyState title={emptyTitle} hint={emptyHint} Icon={StarOff} />
      </div>
    );
  }

  const visible = items.filter((it) => !hidden.has(it.characterId));
  const term = search.trim().toLowerCase();
  const filtered = term
    ? visible.filter((it) => {
        const haystack = [
          it.characterName,
          ...it.characterTags,
          ...it.characterTags.map((tag) =>
            localizeCharacterTag(tag, dict.characterTagLabels),
          ),
          it.previewContent ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
    : visible;

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      <FilterPills
        filterAllLabel={filterAllLabel}
        filterFolderLabel={filterFolderLabel}
      />
      <div className="relative">
        <Search
          size={14}
          aria-hidden="true"
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-[var(--space-md)] text-text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="nj_sessions_favorites_search w-full rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/40 py-[var(--space-sm)] pr-[var(--space-md)] pl-[calc(var(--space-md)*2+14px)] font-body-zh text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
        />
      </div>

      <div
        // v2 Wave 13「信物墙」—— 收藏从"列表"变成"私人相册"：
        // 竖版立绘卡网格，每张卡 = 一件信物（立绘 + 名字 + 初见
        // 一句 + 烟粉封印角标）。女孩子"珍藏心动对象"的仪式感。
        className="grid grid-cols-2 gap-[var(--space-sm)] sm:grid-cols-3 lg:grid-cols-4"
      >
        {filtered.map((it) => (
          <FavoriteRow
            key={it.characterId}
            item={it}
            previewUnavailable={previewUnavailable}
            inaccessibleHint={inaccessibleHint}
            moreMenuAria={moreMenuAria}
            unfavoriteLabel={unfavoriteLabel}
            unfavoriteError={unfavoriteError}
            onUnfavorited={(id) =>
              setHidden((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
              })
            }
            onUnfavoriteFailed={(id) =>
              setHidden((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function FilterPills({
  filterAllLabel,
  filterFolderLabel,
}: {
  filterAllLabel: string;
  filterFolderLabel: string;
}) {
  // v1 只做「全部收藏」,收藏夹是占位(CLAUDE.md v1 后置清单里有「合集」)。
  // 视觉上保留胶囊对照 /tmp/page/11.jpg,点击不切换。
  return (
    <div className="flex w-full overflow-hidden rounded-[var(--radius-pill)] border border-border-subtle">
      <button
        type="button"
        aria-pressed="true"
        className="flex-1 bg-accent-primary py-[var(--space-sm)] font-display-zh text-base text-text-on-accent"
      >
        {filterAllLabel}
      </button>
      <button
        type="button"
        aria-pressed="false"
        disabled
        className="flex-1 bg-surface-glass/40 py-[var(--space-sm)] font-display-zh text-base text-text-muted disabled:cursor-not-allowed"
      >
        {filterFolderLabel}
      </button>
    </div>
  );
}

function FavoriteRow({
  item,
  previewUnavailable,
  inaccessibleHint,
  moreMenuAria,
  unfavoriteLabel,
  unfavoriteError,
  onUnfavorited,
  onUnfavoriteFailed,
}: {
  item: FavoritedCharacterListItem;
  previewUnavailable: string;
  inaccessibleHint: string;
  moreMenuAria: string;
  unfavoriteLabel: string;
  unfavoriteError: string;
  onUnfavorited: (characterId: string) => void;
  onUnfavoriteFailed: (characterId: string) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const preview = previewSnippet(item.previewContent, 60);

  function handleUnfavorite() {
    // 乐观隐藏:先视觉移除,再发 server action;失败回滚 + 显示错误。
    setError(null);
    onUnfavorited(item.characterId);
    startTransition(async () => {
      const res = await toggleCharacterFavoriteAction(item.characterId, false);
      if (!res.ok) {
        onUnfavoriteFailed(item.characterId);
        setError(unfavoriteError);
        return;
      }
      // server action 已 revalidatePath("/sessions"),拉一次刷新拿真实数据
      router.refresh();
    });
  }

  const inner = (
    // v2 Wave 13「信物墙」信物卡 —— 竖版立绘 + 底部信息条 + 烟粉封印
    <div
      className={`nj_sessions_favorite_item group relative flex aspect-[3/4] flex-col overflow-hidden rounded-[var(--radius-md)] border bg-surface-glass/40 transition-all duration-[200ms] ${
        item.accessible
          ? "border-border-subtle hover:border-accent-amber/50 hover:bg-surface-glass"
          : "border-border-subtle opacity-60"
      }`}
    >
      {/* 立绘 —— 占满整卡 */}
      <div className="absolute inset-0">
        <Avatar
          url={item.characterAvatarUrl}
          fallback={firstChar(item.characterName)}
        />
      </div>

      {/* 底部信息条（银箔铭牌同款）—— 名字 + tags + 初见一句 */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-[2px] border-t border-white/10 bg-gradient-to-t from-black/90 via-black/75 to-black/40 px-[var(--space-sm)] pt-[var(--space-md)] pb-[var(--space-sm)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-[var(--space-xs)]">
          <span className="truncate font-display-zh text-sm text-white">
            {item.characterName}
          </span>
          <span className="nums-oldstyle shrink-0 font-display-en text-[9px] uppercase tracking-[0.15em] text-white/50">
            {item.accessible
              ? new Date(item.favoritedAt).toLocaleDateString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                })
              : inaccessibleHint}
          </span>
        </div>
        <p className="line-clamp-2 break-words font-body-zh text-[11px] leading-snug text-white/70">
          {preview ?? (
            <span className="italic text-white/50">{previewUnavailable}</span>
          )}
        </p>
      </div>

      {/* 烟粉封印角标 —— 右上角，rose-veil，象征"心动的印记" */}
      <span
        aria-hidden="true"
        className="absolute right-[var(--space-xs)] top-[var(--space-xs)] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-rose-veil/50 bg-bg-base/40 backdrop-blur-md"
      >
        <span className="h-[5px] w-[5px] rounded-full bg-rose-veil" />
      </span>

      {/* 菜单 —— 右上角封印旁的 more 按钮，点击不跳转 */}
      <div className="absolute left-[var(--space-xs)] top-[var(--space-xs)] z-20">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={moreMenuAria}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="nj_sessions_favorite_more_btn flex h-7 w-7 items-center justify-center rounded-full bg-bg-base/40 text-white/70 backdrop-blur-md transition-colors hover:bg-surface-glass hover:text-text-primary"
            >
              <MoreVertical size={14} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={6}
              align="start"
              className="nj_sessions_favorite_more_menu z-[80] min-w-[160px] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-xs)] shadow-(--shadow-overlay) focus:outline-none"
            >
              <DropdownMenu.Item
                className="nj_sessions_favorite_unfavorite_item flex cursor-pointer items-center gap-[var(--space-sm)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
                onSelect={(e) => {
                  e.preventDefault();
                  handleUnfavorite();
                }}
              >
                <StarOff width={15} height={15} strokeWidth={1.5} />
                {unfavoriteLabel}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {error && (
        <span
          className="absolute inset-x-0 bottom-0 z-30 bg-bg-base/90 px-[var(--space-sm)] py-[2px] text-center text-xs text-semantic-error"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );

  // 收藏卡片优先跳到当前临时对话(已有则直接进对话页;没有则角色页让用户开始对话)
  const href = item.accessible
    ? `/chat/${item.characterId}`
    : `/characters/${item.characterId}`;

  return (
    <Link
      href={href}
      className="block rounded-[var(--radius-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
    >
      {inner}
    </Link>
  );
}

function Avatar({ url, fallback }: { url: string | null; fallback: string }) {
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: external URLs
      <img src={url} alt="" className="h-full w-full object-cover object-top" />
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center bg-surface-solid font-display-zh text-4xl text-text-muted">
      {fallback}
    </span>
  );
}
