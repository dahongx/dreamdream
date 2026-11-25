"use client";

import { Heart, Share2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import {
  toggleCharacterFavoriteAction,
  toggleCharacterLikeAction,
} from "@/lib/favorites/actions";
import { copyTextToClipboard } from "@/lib/util/clipboard";

/**
 * 角色详情页 hero 上的「点赞 / 收藏 / 分享」三个胶囊按钮。
 *
 * - 点赞、收藏:登录后可点;optimistic update,失败时回滚并显示错误。
 * - 分享:直接把分享链接复制到剪贴板(走公共 copyTextToClipboard helper,
 *   secure context 用 navigator.clipboard,否则降级 execCommand)。不调
 *   navigator.share —— 桌面 Chrome/Edge 上它存在但常以 NotAllowedError
 *   告终,体验是「点了没反应或报错」,反而不如直接复制。
 * - 未登录态:整组仍然展示,但点击点赞/收藏会推用户去 /signin。
 *
 * 视觉对齐 /tmp/page/13.jpg:三个胶囊,心(♥ 红)、星(★ 金)、share(灰),
 * 数字紧跟图标,按下激活时填色 + 边框换色。
 */

interface Props {
  characterId: string;
  viewerId: string | null;
  initial: {
    liked: boolean;
    favorited: boolean;
    likeCount: number;
    favoriteCount: number;
  };
}

export function CharacterEngagementButtons({
  characterId,
  viewerId,
  initial,
}: Props) {
  const router = useRouter();
  const { dict, locale } = useI18n();

  const [liked, setLiked] = useState(initial.liked);
  const [favorited, setFavorited] = useState(initial.favorited);
  const [likeCount, setLikeCount] = useState(initial.likeCount);
  const [favoriteCount, setFavoriteCount] = useState(initial.favoriteCount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shareFlash, setShareFlash] = useState(false);

  function gateLogin(): boolean {
    if (viewerId) return true;
    router.push("/signin");
    return false;
  }

  function toggleLike() {
    if (!gateLogin()) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((n) => n + (nextLiked ? 1 : -1));
    setError(null);
    startTransition(async () => {
      const res = await toggleCharacterLikeAction(characterId, nextLiked);
      if (!res.ok) {
        // 回滚
        setLiked(!nextLiked);
        setLikeCount((n) => n + (nextLiked ? -1 : 1));
        setError(dict.characterDetail.comments.actionFailed);
      }
    });
  }

  function toggleFavorite() {
    if (!gateLogin()) return;
    const nextFav = !favorited;
    setFavorited(nextFav);
    setFavoriteCount((n) => n + (nextFav ? 1 : -1));
    setError(null);
    startTransition(async () => {
      const res = await toggleCharacterFavoriteAction(characterId, nextFav);
      if (!res.ok) {
        setFavorited(!nextFav);
        setFavoriteCount((n) => n + (nextFav ? -1 : 1));
        setError(dict.characterDetail.comments.actionFailed);
      }
    });
  }

  async function share() {
    // 分享入口 = /share/<characterId>。访客打开会被 middleware 拦到 /signin,
    // 登录后回跳到这里再 302 进角色详情;已登录用户直接进详情页。
    if (typeof window === "undefined") return;
    const url = new URL(`/share/${characterId}`, window.location.origin);
    url.searchParams.set("lang", locale);
    const ok = await copyTextToClipboard(url.toString());
    if (ok) {
      setError(null);
      setShareFlash(true);
      setTimeout(() => setShareFlash(false), 1600);
    } else {
      setError(detail.shareFailed);
    }
  }

  const detail = dict.characterDetail;

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
      <button
        type="button"
        onClick={toggleLike}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? detail.likeAriaActive : detail.likeAria}
        className={`nj_character_like_btn nj-heart-burst inline-flex items-center gap-[6px] rounded-[var(--radius-pill)] border px-[var(--space-md)] py-[6px] text-sm transition-colors disabled:opacity-60 ${
          liked
            ? "border-semantic-error/40 bg-semantic-error/10 text-semantic-error"
            : "border-border-subtle bg-surface-glass/40 text-text-muted hover:border-border-strong hover:text-text-primary"
        }`}
      >
        <Heart
          size={16}
          aria-hidden="true"
          className={liked ? "fill-current" : undefined}
        />
        <span className="nums-oldstyle">{likeCount}</span>
      </button>
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={pending}
        aria-pressed={favorited}
        aria-label={favorited ? detail.favoriteAriaActive : detail.favoriteAria}
        className={`nj_character_favorite_btn nj-heart-burst nj-seal-ring inline-flex items-center gap-[6px] rounded-[var(--radius-pill)] border px-[var(--space-md)] py-[6px] text-sm transition-colors disabled:opacity-60 ${
          favorited
            ? "border-rose-veil/50 bg-rose-veil/10 text-rose-veil"
            : "border-border-subtle bg-surface-glass/40 text-text-muted hover:border-border-strong hover:text-text-primary"
        }`}
      >
        <Star
          size={16}
          aria-hidden="true"
          className={favorited ? "fill-current" : undefined}
        />
        <span className="nums-oldstyle">{favoriteCount}</span>
      </button>
      <button
        type="button"
        onClick={share}
        aria-label={detail.shareAria}
        className={`nj_character_share_btn inline-flex items-center gap-[6px] rounded-[var(--radius-pill)] border px-[var(--space-md)] py-[6px] text-sm transition-colors ${
          shareFlash
            ? "border-accent-primary/50 bg-accent-primary/10 text-accent-primary"
            : "border-border-subtle bg-surface-glass/40 text-text-muted hover:border-border-strong hover:text-text-primary"
        }`}
      >
        <Share2 size={16} aria-hidden="true" />
        {shareFlash && (
          <span className="text-xs" aria-live="polite">
            {detail.shareCopied}
          </span>
        )}
      </button>
      {error && (
        <span className="text-xs text-semantic-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
