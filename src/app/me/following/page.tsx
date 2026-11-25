import { UserPlus } from "lucide-react";
import { redirect } from "next/navigation";
import { FollowingListClient } from "@/components/following/FollowingListClient";
import { BackButton } from "@/components/nav/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRequestDict } from "@/i18n/server";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { getUserFollowingList } from "@/lib/follows/queries";

export const dynamic = "force-dynamic";

/**
 * /me/following — 关注列表页面
 *
 * 顶部不再用 eyebrow+hero 双行,改为一张紧凑的 glass-card 标题:
 * 左侧人头 icon,右侧 "关注列表" + 计数副标题。视觉份量更轻、整页节奏
 * 与 /me 个人主页里的卡片节奏统一。
 */
export default async function FollowingListPage() {
  const userId = await getOptionalUserId();
  const dict = await getRequestDict();

  if (!userId) {
    redirect("/signin?next=/me/following");
  }

  const followingList = await getUserFollowingList(userId);
  const t = dict.following;
  const count = followingList.length;
  const subtitle = t.titleCardSubtitle.replace("{count}", String(count));

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-lg)] px-[var(--page-px)] py-[var(--page-py)]">
      <BackButton label={t.backButton} fallbackHref="/me" />
      <header className="glass-card flex items-center gap-[var(--space-md)] p-[var(--space-md)]">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 text-accent-primary">
          <UserPlus
            width={20}
            height={20}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-[2px]">
          <h1 className="font-display-zh text-xl text-text-primary">
            {t.heroTitle}
          </h1>
          {count > 0 && <p className="text-xs text-text-muted">{subtitle}</p>}
        </div>
      </header>

      {count === 0 ? (
        <EmptyState
          title={t.empty}
          ctaHref="/explore"
          ctaLabel={dict.notFound.goExplore}
          Icon={UserPlus}
        />
      ) : (
        <FollowingListClient initialList={followingList} dict={dict} />
      )}
    </article>
  );
}
