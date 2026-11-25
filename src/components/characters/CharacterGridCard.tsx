import Link from "next/link";
import type { CSSProperties } from "react";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import type { Dict } from "@/i18n/types";
import { localizeCharacterTag } from "@/lib/characters/tags";
import { SFW_MODE } from "@/lib/config/site";
import { toLocalOptimizableMediaSrc } from "@/lib/media/optimizable-src";
import { firstChar } from "@/lib/util/first-char";
import { formatStat } from "@/lib/util/format-stat";

/**
 * 角色卡 grid item —— 全站唯一实现。
 *
 * 之前同一张卡在 explore / creators 主页 / create 库 / me 角色 tab /
 * CreatorCard 三连预览 里复制了五份，信息行、图片加载策略、角标各自
 * 漂移（/me 那份连 R18 角标都掉了）。收敛成 variant 预设：
 *
 *   explore  探索网格：owner + 赞/藏/对话三计数，非 public 角标
 *   creator  创作者主页网格：对话计数，非 public 角标
 *   library  「我的」库网格：对话计数，可见性角标常显（public 用正向紫）
 *   profile  个人页紧凑网格：对话计数，非 public 角标
 *   mini     CreatorCard 三连预览：仅 R18 角标 + 名字 + 2 个 tag
 *
 * hardNav 用原生 <a> 强制整页导航 —— explore 网格用它绕过 @modal 拦截
 * 路由（commit 35d4aea：first click 直出完整详情页）。
 *
 * v2 Wave 6 藏品化升级：
 * - 右上「朱印编号」—— 圆形金色 hairline 章 + oldstyle 数字（从 id 派生，
 *   稳定但无 DB schema 改动），藏书票收藏编号感
 * - 底部「银箔铭牌」—— 独立一条 backdrop-blur 深色底 + 冷银 hairline
 *   顶边，替换原来的渐变遮罩；铭牌感 vs 遮罩感，前者是"展品说明"，
 *   后者是"仓库堆放"
 * - mobile 圆角 12→16px（更暖），desktop 保持 12px
 * - :active 按压反馈：scale(0.98) + shadow 收缩（iOS 160ms 标准阻尼）
 */

/** 从 character id 派生 3 位十进制编号 —— 稳定、无 DB 依赖、藏书票感 */
function serialFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash) % 1000).padStart(3, "0");
}

export interface CharacterCardData {
  id: string;
  name: string;
  bio?: string | null;
  coverImageUrl?: string | null;
  tags?: string[];
  nsfw?: boolean;
  visibility?: "public" | "private" | "unlisted";
  conversationCount?: number;
  likesCount?: number;
  favoritesCount?: number;
  ownerDisplayName?: string | null;
  ownerUsername?: string | null;
}

export type CharacterCardVariant =
  | "explore"
  | "creator"
  | "library"
  | "profile"
  | "mini";

interface Props {
  character: CharacterCardData;
  dict: Dict;
  variant?: CharacterCardVariant;
  /** 原生 <a> 整页导航（绕过 explore 的 @modal 拦截路由） */
  hardNav?: boolean;
  /** 首屏卡片传 "eager" 保 LCP，其余默认 lazy */
  imageLoading?: "eager" | "lazy";
  /** 首张 LCP 封面用 Next 16 preload，其余避免抢带宽 */
  imagePreload?: boolean;
  /** v2 Wave 6：瀑布流大卡变体，aspect-ratio 3/5，仅 mobile explore 用 */
  featured?: boolean;
}

export function CharacterGridCard({
  character: c,
  dict,
  variant = "creator",
  hardNav = false,
  imageLoading = "lazy",
  imagePreload = false,
  featured = false,
}: Props) {
  const mini = variant === "mini";
  void featured;
  const href = `/characters/${c.id}`;
  const serial = serialFromId(c.id);
  const coverImageSrc = c.coverImageUrl
    ? toLocalOptimizableMediaSrc(c.coverImageUrl)
    : null;

  const showVisibilityBadge =
    variant === "library"
      ? c.visibility !== undefined
      : variant !== "mini" && c.visibility !== undefined
        ? c.visibility !== "public"
        : false;

  const visibilityLabel =
    c.visibility === "public"
      ? dict.library.visibilityPublicBadge
      : c.visibility === "private"
        ? dict.characterDetail.visibilityPrivateBadge
        : dict.characterDetail.visibilityUnlistedBadge;

  // 无图与坏图共用同一"素封"占位
  const coverFallback = (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-solid text-text-muted">
      <span
        className={`font-display-zh opacity-30 ${mini ? "text-2xl" : "text-3xl"}`}
      >
        {firstChar(c.name)}
      </span>
    </div>
  );

  const body = (
    <>
      {coverImageSrc ? (
        <ImageWithFallback
          src={coverImageSrc}
          alt={c.name}
          loading={imageLoading}
          decoding="async"
          fetchPriority={imagePreload ? "high" : "auto"}
          fill
          sizes={
            mini
              ? "(max-width: 768px) 33vw, 120px"
              : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          }
          preload={imagePreload}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[400ms] group-hover:scale-[1.03] group-active:scale-[1.01]"
          fallback={coverFallback}
        />
      ) : (
        coverFallback
      )}

      {/* v2 Wave 12「心动脉动」—— tap 卡片时，封面底部一道暖光波从下
          向上荡（250ms），右上朱印同步放大回弹。纯 CSS :active + group。
          光波用 --rose-veil 低饱和 —— "TA 心跳了"的体感，不是炫技。
          只在有立绘的卡上出现（mini 也保留，成本低）。 */}
      <div
        aria-hidden="true"
        className="card-heartbeat pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-2/5"
      />

      {/* 顶部 badge 行：NSFW（左）+ 朱印编号（右）
          Wave 6：右上"visibility 角标"改为"朱印编号"—— 主要视觉焦点从
          管理属性转到藏品属性。visibility 移到左下铭牌上作 metadata */}
      {mini ? (
        !SFW_MODE &&
        c.nsfw && (
          <span className="absolute left-[var(--space-xs)] top-[var(--space-xs)] z-10 rounded-[var(--radius-sm)] bg-accent-amber px-[6px] py-[1px] text-[10px] font-bold leading-tight text-bg-base">
            {dict.nsfw.badge}
          </span>
        )
      ) : (
        <div className="absolute left-[var(--space-sm)] right-[var(--space-sm)] top-[var(--space-sm)] z-10 flex items-start justify-between gap-[var(--space-xs)]">
          {!SFW_MODE && c.nsfw ? (
            <span className="rounded-[var(--radius-sm)] bg-accent-amber px-[6px] py-[1px] text-[10px] font-bold leading-tight text-bg-base">
              {dict.nsfw.badge}
            </span>
          ) : (
            <span />
          )}
          {/* 朱印编号 —— 藏书票收藏号。Wave 12：tap 时 scale 1.15 回弹，
              跟底部心动脉动同步，"整张卡都心跳了一下" */}
          <span
            aria-hidden="true"
            className="nums-oldstyle flex h-[22px] min-w-[32px] items-center justify-center rounded-[var(--radius-pill)] border border-accent-gold/50 bg-bg-base/40 px-[6px] font-display-en text-[10px] font-medium leading-none tracking-[0.05em] text-accent-gold backdrop-blur-md transition-transform duration-[var(--dur-short)] ease-[cubic-bezier(0.2,0,0,1.4)] group-active:scale-[1.15]"
          >
            №{serial}
          </span>
        </div>
      )}

      {/* 底部「银箔铭牌」—— Wave 6：从渐变遮罩改成独立铭牌条。
          独立底色 + 冷银 hairline 顶边 + backdrop-blur。
          铭牌不覆盖整张卡，只占底部约 30-40%，让立绘尽量露出。
          Wave 14：hover 时顶部"序幕"行淡入 —— 金色 hairline +
          一句 opening（bio 首句），像掀开书页看到开场白。 */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col gap-[2px] border-t border-white/10 bg-gradient-to-t from-black/90 via-black/75 to-black/40 backdrop-blur-sm ${
          mini
            ? "px-[var(--space-xs)] pb-[var(--space-xs)] pt-[var(--space-xs)]"
            : "px-[var(--space-sm)] pb-[var(--space-sm)] pt-[var(--space-sm)]"
        }`}
      >
        {!mini && (
          // 序幕行 —— 金色 hairline + bio 首句，hover/tap 时从下淡入。
          // "掀开一角看到开场白"的暗示。
          <div className="pointer-events-none flex items-center gap-[var(--space-xs)] overflow-hidden opacity-0 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-active:opacity-100">
            <span
              aria-hidden="true"
              className="h-px w-[14px] shrink-0 bg-accent-gold/70"
            />
            <span className="line-clamp-1 text-[10px] leading-snug italic text-accent-gold-soft/90">
              {c.bio ?? "…"}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-[var(--space-xs)]">
          <h3
            className={`truncate font-display-zh text-white ${mini ? "text-xs" : "text-sm"}`}
          >
            {c.name}
          </h3>
          {/* visibility 从右上移到铭牌右侧（非 public 才显示）*/}
          {!mini && showVisibilityBadge && c.visibility !== "public" && (
            <span className="shrink-0 font-display-en text-[9px] uppercase tracking-[0.15em] text-white/50">
              {visibilityLabel}
            </span>
          )}
        </div>
        {(c.tags?.length ?? 0) > 0 && (
          <p className="truncate text-[10px] leading-snug text-white/70">
            {(c.tags ?? [])
              .slice(0, mini ? 2 : 4)
              .map((tag) => localizeCharacterTag(tag, dict.characterTagLabels))
              .join(" · ")}
          </p>
        )}
        {!mini && c.bio && (
          <p className="line-clamp-1 text-[10px] leading-snug text-white/60">
            {c.bio}
          </p>
        )}
        {variant === "explore" && (
          <div className="character-grid-card-meta mt-[2px] flex items-center gap-[var(--space-xs)] text-[10px] leading-snug text-white/60">
            <span className="character-grid-card-meta-owner min-w-0 flex-1 truncate text-white/70">
              @
              {c.ownerDisplayName ??
                c.ownerUsername ??
                dict.explore.ownerAnonymous}
            </span>
            <span className="character-grid-card-meta-stat nums-oldstyle shrink-0">
              {dict.explore.likesCountPrefix}
              {formatStat(c.likesCount ?? 0)}
            </span>
            <span className="character-grid-card-meta-stat nums-oldstyle shrink-0">
              {dict.explore.favoritesCountPrefix}
              {formatStat(c.favoritesCount ?? 0)}
            </span>
            <span className="character-grid-card-meta-stat nums-oldstyle shrink-0">
              {dict.explore.conversationCountPrefix}
              {formatStat(c.conversationCount ?? 0)}
            </span>
          </div>
        )}
        {(variant === "creator" ||
          variant === "library" ||
          variant === "profile") && (
          <div className="character-grid-card-meta mt-[2px] flex items-center justify-end gap-[var(--space-xs)] text-[10px] leading-snug text-white/60">
            <span className="character-grid-card-meta-stat nums-oldstyle">
              {dict.explore.conversationCountPrefix}
              {formatStat(c.conversationCount ?? 0)}
            </span>
          </div>
        )}
      </div>
    </>
  );

  // v2 Wave 15：撤销 Wave 6 瀑布流。所有角色卡都是等比 3/4 竖版立绘，
  // featured 大卡（原 3/5 拉伸）会裁掉立绘头顶导致构图变形。
  // 现在 featured prop 保留但不再影响 aspect —— 均匀 grid 最合适。
  //
  // v2 Wave 20「翻页仪式」：卡片设 --nj-card-id（角色 id），配合 CSS
  // view-transition-name: var(--nj-card-id) 做共享元素 morph ——
  // explore 点进详情时这张卡"放大"成详情页 hero。
  const className = `character-grid-card character-grid-card-${variant} glass-card group relative block aspect-[3/4] overflow-hidden rounded-2xl text-[12px] transition-all duration-[200ms] md:rounded-[var(--radius-md)] active:scale-[0.98] active:shadow-none`;
  const vtStyle = { "--nj-card-id": `nj-card-${c.id}` } as CSSProperties;

  // Keep SFW library/profile entries on the same full-detail path as explore.
  if (hardNav || SFW_MODE) {
    return (
      <a href={href} className={className} style={vtStyle}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={vtStyle}>
      {body}
    </Link>
  );
}
