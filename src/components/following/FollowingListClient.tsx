"use client";

import { UserMinus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Dict } from "@/i18n/types";
import { toggleFollowUser } from "@/lib/follows/actions";
import { firstChar } from "@/lib/util/first-char";

interface Creator {
  userId: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  characterCount: number;
}

interface Props {
  initialList: Creator[];
  dict: Dict;
}

export function FollowingListClient({ initialList, dict }: Props) {
  const { confirm } = useDialog();
  const [followingList, setFollowingList] = useState(initialList);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const t = dict.following;

  const handleUnfollow = async (creatorId: string) => {
    const confirmed = await confirm({ body: t.unfollowConfirm, danger: true });
    if (!confirmed) return;

    setUnfollowingId(creatorId);
    const result = await toggleFollowUser(creatorId);

    if (result.success && !result.isFollowing) {
      // 从列表中移除
      setFollowingList((prev) => prev.filter((c) => c.userId !== creatorId));
    }

    setUnfollowingId(null);
  };

  if (followingList.length === 0) {
    return (
      <EmptyState
        title={t.empty}
        ctaHref="/explore"
        ctaLabel={dict.notFound.goExplore}
        Icon={UserMinus}
      />
    );
  }

  return (
    <section className="flex flex-col gap-[var(--space-sm)]">
      {followingList.map((creator) => {
        const displayName =
          creator.displayName ?? creator.name ?? creator.username ?? "—";
        const bio = creator.bio ?? "";
        const isUnfollowing = unfollowingId === creator.userId;

        return (
          <article
            key={creator.userId}
            className="glass-card flex items-center gap-[var(--space-md)] p-[var(--space-md)]"
          >
            {/* avatar + 文字块整体走作者主页;取消关注按钮单独不嵌套链接 */}
            <Link
              href={`/creators/${creator.userId}`}
              className="flex min-w-0 flex-1 items-center gap-[var(--space-md)] rounded-[var(--radius-sm)] outline-none transition-opacity hover:opacity-90 focus-visible:opacity-90"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-solid">
                {creator.avatarUrl ? (
                  // biome-ignore lint/performance/noImgElement: external avatar URLs
                  <img
                    src={creator.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
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
                {bio && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
                    {bio}
                  </p>
                )}
                <div className="flex items-center gap-[var(--space-md)] text-xs text-text-muted">
                  <span>
                    {t.creatorCharactersCount.replace(
                      "{count}",
                      String(creator.characterCount),
                    )}
                  </span>
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => handleUnfollow(creator.userId)}
              disabled={isUnfollowing}
              className="flex shrink-0 items-center gap-[6px] rounded-[var(--radius-sm)] border border-border-strong px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-primary transition-colors hover:border-accent-amber hover:bg-accent-amber/10 hover:text-accent-amber disabled:opacity-50"
            >
              <UserMinus width={14} height={14} strokeWidth={1.8} />
              {isUnfollowing ? "..." : t.unfollowButton}
            </button>
          </article>
        );
      })}
    </section>
  );
}
