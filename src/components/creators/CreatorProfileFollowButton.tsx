"use client";

import { useState, useTransition } from "react";
import type { Dict } from "@/i18n/types";
import { toggleFollowUser } from "@/lib/follows/actions";

interface Props {
  creatorId: string;
  initialFollowing: boolean;
  viewerId: string | null;
  dict: Dict;
}

/**
 * 创作者主页用关注按钮 —— 比 CharacterDetail 那只稍大,放在 hero 卡里。
 * 文案走 dict.creatorProfile,不复用 characterDetail 的 key 是为了让标点 / 长度
 * 在 hero 这种场景下能独立调,后面想加 hover 文案也好扩。
 */
export function CreatorProfileFollowButton({
  creatorId,
  initialFollowing,
  viewerId,
  dict,
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();
  const t = dict.creatorProfile;

  const handleToggle = () => {
    if (!viewerId) {
      alert(t.loginToFollow);
      return;
    }
    if (following && !confirm(t.unfollowConfirm)) return;

    startTransition(async () => {
      const res = await toggleFollowUser(creatorId);
      if (res.success) setFollowing(res.isFollowing);
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={`rounded-[var(--radius-pill)] px-[var(--space-xl)] py-[var(--space-sm)] text-sm font-semibold transition-colors disabled:opacity-50 ${
        following
          ? "border border-accent-primary bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25"
          : "bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover"
      }`}
    >
      {pending ? "..." : following ? t.followingButton : t.followButton}
    </button>
  );
}
