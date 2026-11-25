import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterGridCard } from "@/components/characters/CharacterGridCard";
import { CreatorProfileFollowButton } from "@/components/creators/CreatorProfileFollowButton";
import { BackButton } from "@/components/nav/BackButton";
import { btnSecondary } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { getRequestDict } from "@/i18n/server";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { getCreatorProfile } from "@/lib/characters/creator-queries";
import { firstChar } from "@/lib/util/first-char";
import { formatStat } from "@/lib/util/format-stat";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CreatorProfilePage({ params }: Props) {
  const { id } = await params;
  const dict = await getRequestDict();
  const viewerId = await getOptionalUserId();
  const profile = await getCreatorProfile(id, viewerId);

  if (!profile) {
    notFound();
  }

  const t = dict.creatorProfile;
  const displayName =
    profile.displayName ?? profile.name ?? profile.username ?? "—";
  const bio = profile.bio ?? "";

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-lg)] px-[var(--page-px)] py-[var(--page-py)]">
      {/* 返回 —— 优先 router.back(),从哪进来回哪去;直链进入回退到作者列表 */}
      <BackButton label={t.backButton} fallbackHref="/explore?view=creators" />

      {/* hero 卡 —— avatar / name / username / stats / follow / bio */}
      <section className="glass-card relative flex flex-col gap-[var(--space-lg)] p-[var(--space-xl)]">
        <div className="flex items-start gap-[var(--space-md)]">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-solid">
            {profile.avatarUrl ? (
              <ImageWithFallback
                src={profile.avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
                fallback={
                  <span className="font-display-zh text-3xl text-text-muted">
                    {firstChar(displayName)}
                  </span>
                }
              />
            ) : (
              <span className="font-display-zh text-3xl text-text-muted">
                {firstChar(displayName)}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
            <h1 className="hero-title truncate">{displayName}</h1>
          </div>
        </div>

        {/* 三宫格 stats */}
        <div className="grid grid-cols-3 gap-[var(--space-sm)]">
          <StatTile value={profile.followers} label={t.statFans} />
          <StatTile value={profile.conversations} label={t.statConversations} />
          <StatTile value={profile.characterCount} label={t.statCharacters} />
        </div>

        {/* 关注按钮 —— 自己访问自己的主页不显示关注按钮 */}
        {!profile.isOwn ? (
          <div className="flex justify-center">
            <CreatorProfileFollowButton
              creatorId={profile.userId}
              initialFollowing={profile.isFollowing}
              viewerId={viewerId}
              dict={dict}
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <Link href="/settings" className={btnSecondary}>
              {dict.me.editProfile}
            </Link>
          </div>
        )}

        {/* 简介 */}
        {bio ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
            {bio}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-text-muted/70">
            {t.bioEmpty}
          </p>
        )}
      </section>

      {/* 下方角色列表 */}
      <section className="flex flex-col gap-[var(--space-md)]">
        <h2 className="font-display-zh text-xl text-text-primary">
          {t.charactersHeading}
        </h2>

        {profile.characters.length === 0 ? (
          <EmptyState title={t.charactersEmptyTitle} />
        ) : (
          <div className="grid grid-cols-2 gap-[var(--space-md)] sm:grid-cols-3 lg:grid-cols-4 lg:gap-[var(--space-lg)]">
            {profile.characters.map((c) => (
              <CharacterGridCard
                key={c.id}
                character={c}
                dict={dict}
                variant="creator"
              />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-[2px] rounded-[var(--radius-md)] bg-surface-glass/40 py-[var(--space-md)]">
      <span className="font-display-zh text-2xl text-text-primary">
        {formatStat(value)}
      </span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
