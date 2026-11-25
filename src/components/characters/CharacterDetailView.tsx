import { MessageSquare } from "lucide-react";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { CharacterComments } from "@/components/characters/CharacterComments";
import { CharacterEngagementButtons } from "@/components/characters/CharacterEngagementButtons";
import { CharacterReelSection } from "@/components/characters/CharacterReelSection";
import { CreatorFollowButton } from "@/components/characters/CreatorFollowButton";
import { DeleteCharacterButton } from "@/components/characters/DeleteCharacterButton";
import { ModalCloseButton } from "@/components/characters/ModalCloseButton";
import { ModalShell } from "@/components/characters/ModalShell";
import { BackButton } from "@/components/nav/BackButton";
import { btnGold, btnSecondary } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { getRequestI18n } from "@/i18n/server";
import type { Locale } from "@/i18n/types";
import { isCurrentUserDeveloper } from "@/lib/auth/current-user";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { listCharacterComments } from "@/lib/characters/comments";
import { localizeCharacterTag } from "@/lib/characters/tags";
import { SFW_MODE } from "@/lib/config/site";
import { db } from "@/lib/db/client";
import { type Character, users } from "@/lib/db/schema";
import { getCharacterEngagement } from "@/lib/favorites/queries";
import { getDefaultMask } from "@/lib/masks/queries";
import type { OpeningComponentWithSlots } from "@/lib/opening/queries";
import { firstChar } from "@/lib/util/first-char";

interface Creator {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

type DictType = Awaited<ReturnType<typeof getRequestI18n>>["dict"];

/** 空封面/坏图共用的"素书封"占位：星点 + 斜向微渐变 + 大号衬线首字。 */
function heroCoverFallback(name: string) {
  return (
    <div className="cosmic-dust flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-glass via-bg-elevated to-bg-base text-text-muted">
      <span className="font-display-zh text-7xl opacity-25">
        {firstChar(name)}
      </span>
    </div>
  );
}

/** 可见性角标文案 —— page hero / modal 卡两处共用，别再各写一份三元。 */
function visibilityLabel(
  visibility: Character["visibility"],
  dict: DictType,
): string {
  if (visibility === "public") return dict.library.visibilityPublicBadge;
  if (visibility === "unlisted")
    return dict.characterDetail.visibilityUnlistedBadge;
  return dict.characterDetail.visibilityPrivateBadge;
}

function genderLabel(gender: Character["gender"], dict: DictType): string {
  if (gender === "male") return dict.characterForm.genderMale;
  if (gender === "female") return dict.characterForm.genderFemale;
  if (gender === "other") return dict.characterForm.genderOther;
  return dict.characterForm.genderUnset;
}

/**
 * 「作者的话」—— page / modal 两种密度共用一份渲染。
 * editorial 处理：
 * - 左侧金色竖线 —— v2 Wave 5 从冷银改成 --accent-gold，作者手写信笺感，
 *   金色作为"珍贵的作者话语"的语义（DESIGN.md 90/10 里的 10 点睛）
 * - 右上淡金色装饰引号 —— Fraunces 大字号 opacity 极低，纯装饰，
 *   把"作者的话"变成"手写引用"的排版语汇
 * - 标题衬线 lg，正文 sm
 */
function CreatorNoteCard({
  note,
  dict,
  compact = false,
  className = "",
  style,
}: {
  note: string;
  dict: DictType;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`glass-card glass-card-static relative flex flex-col overflow-hidden ${
        compact
          ? "gap-[var(--space-xs)] p-[var(--space-md)]"
          : "gap-[var(--space-sm)] p-[var(--space-lg)]"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-[var(--space-md)] left-0 w-[2px] rounded-full bg-accent-gold"
      />
      {/* 淡金色装饰引号 —— Fraunces 大字号 opacity 8%，纯排版装饰 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[var(--space-sm)] right-[var(--space-md)] font-display-en text-[64px] font-bold leading-none text-accent-gold/10"
      >
        &ldquo;
      </span>
      <h2
        className={`font-display-zh text-text-primary ${compact ? "text-sm" : "text-lg"}`}
      >
        {dict.characterDetail.creatorNoteTitle}
      </h2>
      <p
        className={`whitespace-pre-wrap font-body-zh leading-loose text-text-secondary ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {note}
      </p>
    </div>
  );
}

interface Props {
  character: Character;
  mode: "page" | "modal";
  commentsPage: number;
  commentsSort: "latest" | "likes";
  openingComponents?: OpeningComponentWithSlots[];
  globalCss?: string;
  creator?: Creator | null;
  creatorFollowing?: boolean;
}

/**
 * 角色详情视图。两种 mode:
 *
 * - `page`(/characters/[id])：参考 /tmp/page/13.jpg 的 hero —— 顶部一整块封面图
 *   bg + 渐变压色,头像贴左下、姓名 / tags / bio / 更新时间 / 点赞 / 收藏 / 分享
 *   / 对话数挤一行。底下是「作者的话」+ 演绎室 + 评论区,单列流式。
 *
 * - `modal`(/explore 弹窗预览)：保留原来的左右双栏 + 顶部小标题,空间紧凑,不
 *   挂 hero(弹窗本身已经把焦点定在卡片上,再来一个 hero 视觉重了)。
 *
 * 收藏 / 点赞数据只在 page mode 拉,modal 不显示点赞收藏按钮(避免在弹窗里点
 *  star 让人误以为收到了角色卡而不是角色对象)。
 */
export async function CharacterDetailView({
  character,
  mode,
  commentsPage,
  commentsSort,
  openingComponents = [],
  globalCss = "",
  creator = null,
  creatorFollowing = false,
}: Props) {
  const { dict, locale } = await getRequestI18n();
  const isModal = mode === "modal";
  const viewerId = await getOptionalUserId();
  const [commentPage, engagement, defaultMask, viewerRows] = await Promise.all([
    listCharacterComments({
      characterId: character.id,
      viewerId,
      anonymousUserName: dict.characterDetail.comments.anonymousUser,
      page: commentsPage,
      sort: commentsSort,
    }),
    // modal 不需要,空对象避免拉一次 DB
    isModal
      ? Promise.resolve({
          likeCount: 0,
          favoriteCount: 0,
          liked: false,
          favorited: false,
        })
      : getCharacterEngagement(character.id, viewerId),
    viewerId ? getDefaultMask(viewerId) : Promise.resolve(null),
    viewerId
      ? db
          .select({
            displayName: users.displayName,
            username: users.username,
            name: users.name,
          })
          .from(users)
          .where(eq(users.id, viewerId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const viewer = viewerRows[0];
  const previewUserName =
    defaultMask?.name ||
    viewer?.displayName ||
    viewer?.username ||
    viewer?.name ||
    dict.characterDetail.previewGuestName;

  const isOwner = !!viewerId && viewerId === character.ownerId;
  // 开发者(NIMIR_DEBUG_EMAILS)在任意卡上也露出「编辑」入口,方便排障调 prompt;
  // 删除仍只给 owner(见下方),避免误删他人卡。
  const isDev = await isCurrentUserDeveloper();
  const canEditCard = isOwner || isDev;
  const startChatHref = viewerId ? `/chat/${character.id}` : "/signin";
  const startChatLabel = viewerId
    ? dict.characterDetail.startChatButton
    : dict.quota.guestSignInPrompt;

  if (isModal) {
    return (
      <ModalShell
        fallbackHref="/explore"
        closeOnBackdrop={false}
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 px-[var(--space-md)] py-[var(--space-md)] backdrop-blur-md md:px-[var(--space-xl)] md:py-[var(--space-xl)]"
      >
        <article className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-bg-elevated/95 shadow-2xl">
          <header className="flex items-start justify-end gap-[var(--space-md)] px-[var(--space-md)] py-[var(--space-sm)] md:px-[var(--space-lg)] md:py-[var(--space-md)]">
            <div className="flex flex-shrink-0 items-center gap-[var(--space-sm)]">
              <Link href={startChatHref} className={btnGold}>
                {startChatLabel}
              </Link>
              <ModalCloseButton
                label={dict.characterDetail.closePreview}
                fallbackHref="/explore"
              />
            </div>
          </header>
          <div className="grid flex-1 gap-[var(--space-md)] overflow-y-auto px-[var(--space-md)] pb-[var(--space-md)] md:px-[var(--space-lg)] md:pb-[var(--space-lg)] lg:grid-cols-[minmax(220px,280px)_1fr]">
            <CharacterCard character={character} dict={dict} />
            <section className="flex flex-col gap-[var(--space-sm)]">
              {character.creatorNote && (
                <CreatorNoteCard
                  note={character.creatorNote}
                  dict={dict}
                  compact
                />
              )}
              {openingComponents.length > 0 && (
                <CharacterReelSection
                  title={dict.characterDetail.reelTitle}
                  collapseLabel={dict.characterDetail.reelCollapse}
                  expandLabel={dict.characterDetail.reelExpand}
                  components={openingComponents}
                  globalCss={globalCss}
                  characterId={character.id}
                  characterName={character.name}
                  previewUserName={previewUserName}
                />
              )}
              <CharacterComments
                characterId={character.id}
                commentsPage={commentPage}
                canModerate={isOwner}
                commentsPath={`/characters/${character.id}`}
              />
            </section>
          </div>
        </article>
      </ModalShell>
    );
  }

  // ───────── page mode: hero per /tmp/page/13.jpg ─────────
  const updatedAtLabel = formatUpdatedAt(character.updatedAt, locale);

  return (
    <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-px)] py-[var(--page-py)] pb-[calc(var(--bottombar-height)+64px)] md:pb-[var(--page-py)]">
      {/* editorial 节奏：区块间 xl；hero 之后额外拉到 2xl（DESIGN.md
          「hero 与 main content 之间」的呼吸档，见 hero section 的 mb）。
          各区块 rise-in + 60ms 错峰进入。 */}
      <article className="flex flex-col gap-[var(--space-xl)]">
        {/* 返回按钮 —— 优先 router.back(); 直链进入(无 history)时回退到 /explore */}
        <BackButton
          label={dict.characterDetail.backButton}
          fallbackHref="/explore"
        />

        {/* 创作者信息区 —— 放在最顶部，仅非 owner 可见。
            薄材质（近景 hero / 远景辅助区的层级），不再用整块 glass-card。 */}
        {creator && !isOwner && (
          <section className="rise-in flex items-center gap-[var(--space-md)] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/40 p-[var(--space-md)]">
            {/* 头像 + 名字 + bio 整块跳转作者主页;关注按钮在 Link 外,避免 a > button 嵌套 */}
            <Link
              href={`/creators/${creator.id}`}
              className="-m-[var(--space-sm)] flex min-w-0 flex-1 items-center gap-[var(--space-md)] rounded-[var(--radius-md)] p-[var(--space-sm)] transition-colors hover:bg-surface-glass/40"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-solid">
                {creator.avatarUrl ? (
                  <ImageWithFallback
                    src={creator.avatarUrl}
                    alt={
                      creator.displayName ??
                      creator.name ??
                      creator.username ??
                      "—"
                    }
                    className="h-full w-full object-cover"
                    fallback={
                      <span className="font-display-zh text-lg text-text-muted">
                        {firstChar(
                          creator.displayName ??
                            creator.name ??
                            creator.username ??
                            "—",
                        )}
                      </span>
                    }
                  />
                ) : (
                  <span className="font-display-zh text-lg text-text-muted">
                    {firstChar(
                      creator.displayName ??
                        creator.name ??
                        creator.username ??
                        "—",
                    )}
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <p className="text-xs text-text-muted">
                  {dict.characterDetail.creatorSectionTitle}
                </p>
                <h3 className="truncate font-display-zh text-base text-text-primary">
                  {creator.displayName ??
                    creator.name ??
                    creator.username ??
                    "—"}
                </h3>
                {creator.bio && (
                  <p className="line-clamp-1 text-xs text-text-secondary">
                    {creator.bio}
                  </p>
                )}
              </div>
            </Link>

            <CreatorFollowButton
              creatorId={creator.id}
              initialFollowing={creatorFollowing}
              viewerId={viewerId}
              dict={dict}
            />
          </section>
        )}

        {/* hero —— 这一页的"书封"。creative-editorial：封面更高（42vh 封顶
            420px）、多段缓动 scrim 让图底"溶"进页面底色、角色名给足衬线
            尺寸。mb 把 hero→正文的间距从 xl 拉到 2xl。 */}
        <section
          className="rise-in relative mb-[calc(var(--space-2xl)-var(--space-xl))] overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-surface-glass"
          style={{ animationDelay: "60ms" }}
        >
          {/* v2 Wave 20「翻页仪式」：hero 设 --nj-card-id 与 explore 卡片
              同值 → view-transition-name 配对，cross-document 导航时这张
              立绘从卡片"放大"成详情 hero（共享元素 morph）。 */}
          <div
            className="detail-hero-media relative w-full overflow-hidden bg-surface-solid"
            style={
              {
                "--nj-card-id": `nj-card-${character.id}`,
              } as React.CSSProperties
            }
          >
            {character.coverImageUrl ? (
              <ImageWithFallback
                src={character.coverImageUrl}
                alt=""
                ariaHidden
                className="h-full w-full object-cover"
                fallback={heroCoverFallback(character.name)}
              />
            ) : (
              heroCoverFallback(character.name)
            )}
            {/* v2 Wave 11「烛光初见」：角色立绘底部一道暖烛光底光。
                radial-gradient 从画面中心偏下发暖光，只笼罩立绘下半部。
                --rose-veil + 暖金低饱和混合 —— "烛光下的两人世界"，
                跟全局冷银画廊形成进入详情页的氛围切换。
                绝不做全局；只在详情页 hero 出现。
                DOM 顺序在 scrim 之前：先照亮立绘，scrim 再压暗底部
                保证信息区文字可读 —— 烛光是"光"，不是"遮罩"。 */}
            <div
              aria-hidden="true"
              className="hero-candle-glow pointer-events-none absolute inset-0"
            />
            {/* 多段缓动压图渐变（.hero-scrim）—— 末段全不透明，信息区
                文字坐在实底上；不再有三段线性的可见色带。 */}
            <div className="hero-scrim absolute inset-0" />
            {/* 右上 badge */}
            <div className="absolute right-[var(--space-md)] top-[var(--space-md)] flex items-center gap-[var(--space-sm)]">
              <span className="rounded-[var(--radius-pill)] bg-bg-base/75 px-[var(--space-sm)] py-[2px] text-[10px] uppercase tracking-wider text-text-muted backdrop-blur-sm">
                {visibilityLabel(character.visibility, dict)}
              </span>
              {!SFW_MODE && character.nsfw && (
                <span className="rounded-[var(--radius-pill)] bg-accent-amber/25 px-[var(--space-sm)] py-[2px] text-[10px] text-accent-amber backdrop-blur-sm">
                  {dict.nsfw.badge}
                </span>
              )}
            </div>
          </div>

          {/* 下半信息区,跨越 banner 与下方,呈「半压在图上」效果。
              上提量与 scrim 不透明段联动：scrim 末端 9% 全实底，120px
              的信息区首行落在 >91% 不透明区域内，文字对比度有保证。 */}
          <div className="relative -mt-[var(--detail-hero-overlap)] flex flex-col gap-[var(--space-md)] px-[var(--space-md)] pb-[var(--space-lg)] md:flex-row md:items-end md:gap-[var(--space-lg)] md:px-[var(--space-lg)]">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border-2 border-border-strong bg-surface-solid shadow-2xl md:h-32 md:w-32">
              {character.avatarUrl ? (
                <ImageWithFallback
                  src={character.avatarUrl}
                  alt={character.name}
                  className="h-full w-full object-cover"
                  fallback={
                    <span className="font-display-zh text-3xl text-text-muted">
                      {firstChar(character.name)}
                    </span>
                  }
                />
              ) : (
                <span className="font-display-zh text-3xl text-text-muted">
                  {firstChar(character.name)}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-sm)]">
              <div className="flex flex-wrap items-baseline gap-x-[var(--space-md)] gap-y-[var(--space-xs)]">
                {/* .hero-title 是未分层规则，原来挂的 text-2xl md:text-3xl
                    是永远不生效的死代码类 —— 字号由 clamp 决定（桌面顶到
                    3xl，DESIGN.md 聊天/详情角色名的规格）。 */}
                <h1 className="hero-title">{character.name}</h1>
                <span className="inline-flex items-center gap-[4px] text-sm text-text-muted">
                  <MessageSquare size={14} aria-hidden="true" />
                  <span className="tabular-nums">
                    {character.conversationCount.toLocaleString()}
                  </span>
                  <span className="text-xs">
                    {dict.characterDetail.conversationCountLabel}
                  </span>
                </span>
              </div>

              {character.bio && (
                /* bio 是读者决定要不要点开聊的第一段文案，升到 base ——
                   原 text-sm 跟 metadata 同级，层级是平的。 */
                <p className="max-w-2xl font-body-zh text-base leading-relaxed text-text-primary">
                  {character.bio}
                </p>
              )}

              {character.tags.length > 0 && (
                <div className="flex flex-wrap gap-[var(--space-xs)]">
                  {character.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass/40 px-[var(--space-sm)] py-[2px] text-xs text-text-secondary"
                    >
                      {localizeCharacterTag(tag, dict.characterTagLabels)}
                    </span>
                  ))}
                </div>
              )}

              {updatedAtLabel && (
                <p className="font-mono text-xs text-text-muted">
                  {dict.characterDetail.updatedAtPrefix}
                  {updatedAtLabel}
                </p>
              )}

              <div className="mt-[var(--space-xs)] flex flex-wrap items-center justify-between gap-[var(--space-md)]">
                <CharacterEngagementButtons
                  characterId={character.id}
                  viewerId={viewerId}
                  initial={engagement}
                />
                <div className="flex flex-shrink-0 flex-wrap items-center gap-[var(--space-sm)]">
                  <Link href={startChatHref} className={btnGold}>
                    {startChatLabel}
                  </Link>
                  {canEditCard && (
                    <Link
                      href={`/characters/${character.id}/edit`}
                      className={btnSecondary}
                    >
                      {dict.characterDetail.editButton}
                    </Link>
                  )}
                  {isOwner && (
                    <DeleteCharacterButton
                      characterId={character.id}
                      characterName={character.name}
                      variant="topbar"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {character.creatorNote && (
          <CreatorNoteCard
            note={character.creatorNote}
            dict={dict}
            className="rise-in"
            style={{ animationDelay: "120ms" }}
          />
        )}

        {openingComponents.length > 0 && (
          <div className="rise-in" style={{ animationDelay: "180ms" }}>
            <CharacterReelSection
              title={dict.characterDetail.reelTitle}
              collapseLabel={dict.characterDetail.reelCollapse}
              expandLabel={dict.characterDetail.reelExpand}
              components={openingComponents}
              globalCss={globalCss}
              characterId={character.id}
              characterName={character.name}
              previewUserName={previewUserName}
            />
          </div>
        )}

        <div className="rise-in" style={{ animationDelay: "240ms" }}>
          <CharacterComments
            characterId={character.id}
            commentsPage={commentPage}
            canModerate={isOwner}
            commentsPath={`/characters/${character.id}`}
          />
        </div>
      </article>

      {/* v2 Wave 9：mobile sticky bottom CTA bar —— 坐在 MobileTabBar 之上
          (bottom offset = tab bar 56px + safe-area)。只 mobile 显示，desktop
          保持内联按钮。
          这是角色详情页 mobile 的核心 CTA —— 不用往下滚就能"入戏"。 */}
      <div
        className="fixed inset-x-0 z-40 flex items-center gap-[var(--space-sm)] border-t border-border-subtle bg-bg-elevated/95 px-[var(--space-md)] pt-[var(--space-sm)] backdrop-blur-md md:hidden"
        style={{
          // 坐在 tab bar 之上；tab bar 自带 safe-area padding，这里再补一份
          // pb 让 CTA 内容不贴到 tab bar 上沿
          bottom: "var(--bottombar-height)",
          paddingBottom: "var(--space-sm)",
        }}
      >
        <Link
          href={startChatHref}
          aria-label={startChatLabel}
          className={`${btnGold} flex-1 py-[10px] text-base`}
        >
          {startChatLabel}
        </Link>
      </div>
    </div>
  );
}

/** 列表卡(modal 用)。和原 CharacterDetailView page-mode 左栏的样式一致。 */
function CharacterCard({
  character,
  dict,
}: {
  character: Character;
  dict: DictType;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] bg-surface-glass">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-solid">
        {character.coverImageUrl ? (
          // biome-ignore lint/performance/noImgElement: external URLs, no remote-host pattern set yet
          <img
            src={character.coverImageUrl}
            alt={character.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            <span className="font-display-zh text-3xl opacity-30">
              {firstChar(character.name)}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-[var(--space-sm)] bg-gradient-to-b from-bg-base/70 to-transparent px-[var(--space-sm)] py-[var(--space-sm)]">
          <div className="flex items-center gap-[var(--space-xs)]">
            <span className="rounded-[var(--radius-sm)] bg-bg-base/75 px-[var(--space-sm)] py-[2px] text-[10px] text-text-muted backdrop-blur-sm">
              {visibilityLabel(character.visibility, dict)}
            </span>
            {!SFW_MODE && character.nsfw && (
              <span className="rounded-[var(--radius-sm)] bg-accent-amber/25 px-[var(--space-sm)] py-[2px] text-[10px] text-accent-amber backdrop-blur-sm">
                {dict.nsfw.badge}
              </span>
            )}
          </div>
          <span className="rounded-[var(--radius-sm)] bg-bg-base/75 px-[var(--space-sm)] py-[2px] text-[10px] text-text-muted backdrop-blur-sm">
            {dict.explore.conversationCountPrefix}
            {character.conversationCount}
          </span>
        </div>
      </div>
      <div className="space-y-[var(--space-sm)] p-[var(--space-md)]">
        <div className="flex items-center justify-between gap-[var(--space-sm)]">
          <h2 className="font-display-zh text-lg text-text-primary">
            {character.name}
          </h2>
          <span className="rounded-[var(--radius-pill)] bg-accent-primary/15 px-[var(--space-sm)] py-[2px] text-[10px] text-accent-primary">
            {genderLabel(character.gender, dict)}
          </span>
        </div>
        <div className="flex flex-wrap gap-[var(--space-xs)]">
          {character.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-sm)] py-[1px] text-[10px] text-text-secondary"
            >
              {localizeCharacterTag(tag, dict.characterTagLabels)}
            </span>
          ))}
        </div>
        {character.bio && (
          <p className="border-l-2 border-accent-primary/40 pl-[var(--space-sm)] font-body-zh text-xs leading-relaxed text-text-primary">
            {character.bio}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * 格式化角色 updatedAt，并按当前界面语言选择数字与日期符号。
 *
 * 不依赖 dayjs / date-fns —— 项目里没装,Intl.DateTimeFormat 足够。沿用
 * `Asia/Shanghai` 作为服务端统一时区，避免部署环境漂移；用户时区留待后续拆分。
 */
function formatUpdatedAt(
  d: Date | null | undefined,
  locale: Locale,
): string | null {
  if (!d) return null;
  try {
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return fmt.format(d);
  } catch {
    return null;
  }
}
