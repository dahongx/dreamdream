"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CharacterGridCard } from "@/components/characters/CharacterGridCard";
import { useDialog } from "@/components/ui/DialogProvider";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import type { Dict } from "@/i18n/types";
import type { CreatorListItem } from "@/lib/characters/creator-queries";
import { toggleFollowUser } from "@/lib/follows/actions";
import { firstChar } from "@/lib/util/first-char";
import { formatStat } from "@/lib/util/format-stat";

interface Props {
  creator: CreatorListItem;
  viewerId: string | null;
  dict: Dict;
}

export function CreatorCard({ creator, viewerId, dict }: Props) {
  const t = dict.explore;
  const detailT = dict.characterDetail;
  const [following, setFollowing] = useState(creator.isFollowing);
  const [pending, startTransition] = useTransition();
  // 全站统一确认/提示框（原生 confirm/alert 是系统白样式，出戏）
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();

  const displayName =
    creator.displayName ?? creator.name ?? creator.username ?? "—";

  const isOwn = viewerId === creator.userId;

  const handleToggle = async () => {
    if (!viewerId) {
      void alertDialog({ body: detailT.loginToFollow });
      return;
    }
    if (following && !(await confirmDialog({ body: detailT.unfollowConfirm })))
      return;

    startTransition(async () => {
      const res = await toggleFollowUser(creator.userId);
      if (res.success) setFollowing(res.isFollowing);
    });
  };

  return (
    <article className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-md)]">
      {/* header row：avatar + name + stats + 关注 button */}
      <header className="flex items-center gap-[var(--space-md)]">
        {/* 整块 (avatar + name + stats) 都进创作者主页;关注按钮维持独立 click target */}
        <Link
          href={`/creators/${creator.userId}`}
          className="flex min-w-0 flex-1 items-center gap-[var(--space-md)] rounded-[var(--radius-sm)] outline-none transition-opacity hover:opacity-90 focus-visible:opacity-90"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-solid">
            {creator.avatarUrl ? (
              <ImageWithFallback
                src={creator.avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
                fallback={
                  <span className="font-display-zh text-xl text-text-muted">
                    {firstChar(displayName)}
                  </span>
                }
              />
            ) : (
              <span className="font-display-zh text-xl text-text-muted">
                {firstChar(displayName)}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
            <h2 className="truncate font-display-zh text-base text-text-primary">
              {displayName}
            </h2>
            <div className="flex flex-wrap items-center gap-[var(--space-md)] text-xs text-text-muted">
              <span>
                {t.creatorFollowers} {formatStat(creator.followers)}
              </span>
              <span>
                {t.creatorConversations} {formatStat(creator.conversations)}
              </span>
            </div>
          </div>
        </Link>

        {!isOwn && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={pending}
            className={`shrink-0 rounded-[var(--radius-pill)] px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold transition-colors disabled:opacity-50 ${
              following
                ? "border border-accent-primary bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25"
                : "bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover"
            }`}
          >
            {pending
              ? "..."
              : following
                ? detailT.followingButton
                : detailT.followButton}
          </button>
        )}
      </header>

      {/* 角色三连预览 —— hardNav 与探索网格一致（同一页两种打开方式
          之前是分裂的：网格 <a> 直出详情页，这里 <Link> 会弹 @modal） */}
      {creator.topCharacters.length > 0 ? (
        <div className="grid grid-cols-3 gap-[var(--space-sm)]">
          {creator.topCharacters.map((c) => (
            <CharacterGridCard
              key={c.id}
              character={c}
              dict={dict}
              variant="mini"
              hardNav
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">{t.creatorCharactersEmpty}</p>
      )}
    </article>
  );
}
