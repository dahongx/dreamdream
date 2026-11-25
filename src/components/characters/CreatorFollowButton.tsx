"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import type { Dict } from "@/i18n/types";
import { toggleFollowUser } from "@/lib/follows/actions";

interface Props {
  creatorId: string;
  initialFollowing: boolean;
  viewerId: string | null;
  dict: Dict;
}

export function CreatorFollowButton({
  creatorId,
  initialFollowing,
  viewerId,
  dict,
}: Props) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const t = dict.characterDetail;

  const handleToggle = async () => {
    if (!viewerId) {
      alert(t.loginToFollow);
      return;
    }

    if (isFollowing && !confirm(t.unfollowConfirm)) {
      return;
    }

    setIsLoading(true);
    const result = await toggleFollowUser(creatorId);

    if (result.success) {
      setIsFollowing(result.isFollowing);
    }

    setIsLoading(false);
  };

  const Icon = isFollowing ? UserCheck : UserPlus;
  const label = isFollowing ? t.followingButton : t.followButton;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className={`flex items-center gap-[6px] rounded-[var(--radius-sm)] border px-[var(--space-md)] py-[var(--space-sm)] text-sm transition-colors disabled:opacity-50 ${
        isFollowing
          ? "border-accent-primary bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25"
          : "border-border-strong bg-surface-glass/60 text-text-primary hover:border-accent-primary/60 hover:bg-surface-glass"
      }`}
    >
      <Icon width={14} height={14} strokeWidth={1.8} />
      {isLoading ? "..." : label}
    </button>
  );
}
