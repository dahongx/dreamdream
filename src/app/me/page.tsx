import { count, eq, sql } from "drizzle-orm";
import { Pencil, ShoppingBag, UserPlus, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyIdButton } from "@/components/me/CopyIdButton";
import {
  type ProfileCharacterItem,
  ProfileTabs,
} from "@/components/me/ProfileTabs";
import { PageAtmosphere } from "@/components/PageAtmosphere";
import { getRequestDict } from "@/i18n/server";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import {
  getCreatorEarningDetails,
  getCreatorEarningsOverview,
} from "@/lib/creator/queries";
import { db } from "@/lib/db/client";
import { characters, users } from "@/lib/db/schema";
import { getFollowingCount } from "@/lib/follows/queries";
import { firstChar } from "@/lib/util/first-char";
import {
  getUserCurrencyTransactions,
  getUserWalletInfo,
} from "@/lib/wallet/queries";

export const dynamic = "force-dynamic";

/**
 * /me — 个人主页。布局参考 mufy 的玩家中心:
 *   1. 头像 + 昵称 + Lv + ID 的卡片 hero,右上角编辑入口
 *   2. 三宫格统计(粉丝 / 互动 / 角色)
 *   3. 「好友列表」长条按钮 + 社交链接占位(twitter / discord)
 *   4. 简介文字
 *   5. 「商店」「设置」入口排
 *   6. 「钱包 / 角色」双 tab
 *
 * 数据说明:
 * - 粉丝 / 好友列表 / 商店 / 钱包 在 v1 没有底层表,占位"敬请期待",但
 *   入口位置先卡住,后面接业务时不再调布局。
 * - 互动 = 用户所有角色卡的 conversationCount 之和(已有去标准化字段,
 *   一次 SUM 拿到,不需要扫 messages)。
 * - 角色 = 用户在 characters 表中的行数(同上,直接 count)。
 *
 * 未登录访问统一跳到 /signin,而不是给一份只读 placeholder ——「我的主页」
 * 没有"匿名访问"语义。
 */
export default async function ProfilePage() {
  const userId = await getOptionalUserId();
  const dict = await getRequestDict();
  if (!userId) {
    redirect("/signin?next=/me");
  }

  const [me] = await db
    .select({
      email: users.email,
      displayName: users.displayName,
      username: users.username,
      name: users.name,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // 角色总数 + 互动总数(所有自有角色的 conversationCount SUM)。
  // 一次查询拿两个聚合,比 listMyCharacters 再算便宜得多。
  const [agg] = await db
    .select({
      total: count(characters.id),
      interactions: sql<number>`COALESCE(SUM(${characters.conversationCount}), 0)::int`,
    })
    .from(characters)
    .where(eq(characters.ownerId, userId));

  // 角色卡列表 —— 只取 tab 里要展示的字段。
  const characterList: ProfileCharacterItem[] = await db
    .select({
      id: characters.id,
      name: characters.name,
      bio: characters.bio,
      coverImageUrl: characters.coverImageUrl,
      avatarUrl: characters.avatarUrl,
      conversationCount: characters.conversationCount,
      nsfw: characters.nsfw,
      visibility: characters.visibility,
    })
    .from(characters)
    .where(eq(characters.ownerId, userId))
    .orderBy(sql`${characters.createdAt} DESC`);

  // 钱包信息 + 创作收益
  const [
    walletInfo,
    currencyTransactions,
    followingCount,
    earningsOverview,
    earningsDetails,
  ] = await Promise.all([
    getUserWalletInfo(userId),
    getUserCurrencyTransactions(userId),
    getFollowingCount(userId),
    getCreatorEarningsOverview(userId),
    getCreatorEarningDetails(userId),
  ]);

  const t = dict.me;
  const displayName = me?.displayName ?? me?.name ?? me?.username ?? "—";
  const bio = me?.bio ?? "";
  const characterCount = agg?.total ?? 0;
  const interactions = agg?.interactions ?? 0;
  const fans = 0; // v1 未实现粉丝系统

  // ID 一栏直接显示邮箱(账号本身) —— 比 UUID 直观,也是用户能记住的东西。
  // 邮箱可能为 null(理论上不会,Supabase Auth 要求 email)兜底显示 "—"。
  const idDisplay = me?.email ?? "—";
  const copyableId = me?.email ?? userId;

  return (
    <PageAtmosphere>
      <article className="page-content-narrow mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-lg)] px-[var(--page-px)] py-[var(--page-py)]">
        <header className="page-hero-heading">
          <h1 className="hero-title page-hero-title">{t.heroTitle}</h1>
        </header>
        {/* Hero 卡 —— avatar / name / Lv / ID / edit / stats / friends row */}
        <section className="glass-card relative flex flex-col gap-[var(--space-lg)] p-[var(--space-xl)]">
          <Link
            href="/settings"
            className="absolute right-[var(--space-md)] top-[var(--space-md)] inline-flex items-center gap-[6px] rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass/60 px-[var(--space-sm)] py-[4px] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Pencil width={12} height={12} strokeWidth={1.8} />
            {t.editProfile}
          </Link>

          <div className="flex items-center gap-[var(--space-md)]">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-solid">
              {me?.avatarUrl ? (
                // biome-ignore lint/performance/noImgElement: external avatar URLs
                <img
                  src={me.avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-display-zh text-3xl text-text-muted">
                  {firstChar(displayName)}
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-[6px]">
              <div className="flex items-center gap-[var(--space-sm)]">
                <h2 className="truncate font-display-zh text-2xl text-text-primary">
                  {displayName}
                </h2>
                <span className="nums-oldstyle shrink-0 rounded-[var(--radius-sm)] bg-accent-primary/20 px-[6px] py-[1px] text-[10px] font-semibold uppercase tracking-wide text-accent-primary">
                  {t.levelPrefix}
                  {roleToLevel(me?.role)}
                </span>
                {/* 会员等级徽章 —— v2 Wave 5「夜青银」重构：
                  从 Wave 3 的"金色浓淡三档"改成统一"金色 hairline 胶囊 +
                  内嵌金色小圆点"—— MoMA / 江诗丹顿方向的克制感，等级差异
                  由徽章文本承担（tierName），不靠色阶。金色是 90/10 配比
                  里的 10 点睛色，绝不多用。
                  DESIGN.md「金色珍贵使用」约定：小面积、只用于身份标记。*/}
                {walletInfo.membershipTier &&
                  walletInfo.membershipExpiresAt &&
                  new Date(walletInfo.membershipExpiresAt) > new Date() && (
                    <span className="shrink-0 inline-flex items-center gap-[6px] rounded-[var(--radius-pill)] border border-accent-gold/40 bg-accent-gold/10 px-[10px] py-[2px] font-display-zh text-[11px] tracking-wide text-accent-gold">
                      <span
                        aria-hidden="true"
                        className="h-[4px] w-[4px] rounded-full bg-accent-gold"
                      />
                      {walletInfo.membershipTier === "diamond"
                        ? dict.shop.tierDiamondName
                        : walletInfo.membershipTier === "platinum"
                          ? dict.shop.tierPlatinumName
                          : dict.shop.tierGoldName}
                    </span>
                  )}
              </div>
              <div className="flex items-center gap-[6px] text-xs text-text-muted">
                <span className="truncate">
                  {t.idPrefix}
                  {idDisplay}
                </span>
                <CopyIdButton value={copyableId} />
              </div>
            </div>
          </div>

          {/* 三宫格 stats */}
          <div className="grid grid-cols-3 gap-[var(--space-sm)]">
            <StatTile value={fans} label={t.statFans} />
            <StatTile value={interactions} label={t.statInteractions} />
            <StatTile value={characterCount} label={t.statCharacters} />
          </div>

          {/* 好友列表 + 关注列表 —— v2 Wave 5：从"一实底一 outline"改成
            两个都 outline hairline，避免实底冷银在暗蓝底上产生"紫罗兰"错觉
            + 保持 me 页整体克制调性（点睛金已在会员徽章、商店入口用了） */}
          <div className="flex items-center gap-[var(--space-sm)]">
            <button
              type="button"
              title={t.friendsComingSoon}
              className="flex flex-1 items-center justify-center gap-[8px] rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass/40 px-[var(--space-md)] py-[var(--space-sm)] text-sm font-medium text-text-muted transition-colors disabled:cursor-not-allowed"
              disabled
            >
              <Users width={16} height={16} strokeWidth={1.8} />
              {t.friendsButton}
            </button>
            <Link
              href="/me/following"
              className="flex flex-1 items-center justify-center gap-[8px] rounded-[var(--radius-pill)] border border-border-strong bg-surface-glass/60 px-[var(--space-md)] py-[var(--space-sm)] text-sm font-medium text-text-primary transition-colors hover:border-accent-primary/60 hover:bg-surface-glass"
            >
              <UserPlus width={16} height={16} strokeWidth={1.8} />
              {t.followingButton}
              {followingCount > 0 && (
                <span className="ml-[2px] text-xs text-text-muted">
                  ({followingCount})
                </span>
              )}
            </Link>
          </div>

          {/* 简介 —— users 表暂无字段,留 placeholder 入口 */}
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

        {/* 商店 + 设置 入口排 */}
        <section className="grid grid-cols-2 gap-[var(--space-sm)]">
          <Link
            href="/shop"
            className="glass-card flex items-center justify-center gap-[8px] px-[var(--space-md)] py-[var(--space-md)] text-base text-text-primary transition-colors hover:border-accent-primary/60"
          >
            <ShoppingBag width={18} height={18} strokeWidth={1.6} />
            {t.storeButton}
          </Link>
          <Link
            href="/settings"
            className="glass-card flex items-center justify-center gap-[8px] px-[var(--space-md)] py-[var(--space-md)] text-base text-text-primary transition-colors hover:border-accent-primary/60"
          >
            <UserRound width={18} height={18} strokeWidth={1.6} />
            {t.settingsButton}
          </Link>
        </section>

        <ProfileTabs
          characters={characterList}
          walletInfo={walletInfo}
          currencyTransactions={currencyTransactions}
          earningsOverview={earningsOverview}
          earningsDetails={earningsDetails}
        />
      </article>
    </PageAtmosphere>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-[2px] rounded-[var(--radius-md)] bg-surface-glass/40 py-[var(--space-md)]">
      {/* nums-editorial：Instrument Serif 极窄衬线 —— 粉丝/互动/角色统计
          Aesop 印刷品质感（v2 Wave 10 从 .nums-oldstyle + 中文衬线升级） */}
      <span className="nums-editorial text-2xl text-text-primary">
        {formatStat(value)}
      </span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

function roleToLevel(role: string | null | undefined): number {
  // v1 没有真等级,按 role 给个对应数字,后续接等级系统时再改。
  if (role === "admin") return 99;
  if (role === "beta_tester") return 5;
  return 0;
}

function formatStat(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 10000).toFixed(1)}w`;
}
