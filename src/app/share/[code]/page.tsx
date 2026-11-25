import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { btnPrimaryLg } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { matchSupportedLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getRequestDict } from "@/i18n/server";
import { getCharacterById } from "@/lib/characters/queries";
import { localizeCharacterTag } from "@/lib/characters/tags";
import { SFW_MODE } from "@/lib/config/site";
import { createClient } from "@/lib/supabase/server";
import { firstChar } from "@/lib/util/first-char";

/**
 * 分享落地页 —— /share/<characterId>
 *
 * 之前这里是纯 302：登录用户跳详情，访客被 middleware 拦去 /signin。
 * 问题是社交爬虫永远是"访客"，拿到的是登录页的 meta —— 分享出去的
 * 链接在微信/QQ/Twitter 里全是全站默认卡片，传播链路等于没有封面。
 *
 * 现在分三路：
 *   1. 登录用户 → 302 /characters/<id>（行为不变）
 *   2. 访客 + private 卡 → 302 /signin?next=…（原登录门禁保留，owner
 *      登录后回跳；private 卡的任何字段不对外渲染）
 *   3. 访客 + public/unlisted 卡 → 渲染邀请落地页（200，爬虫可抓 OG）
 *
 * 字段红线：只用 CLAUDE.md「Prompt 资产保护」白名单里的展示字段
 * （name / bio / avatarUrl / coverImageUrl / tags / nsfw），persona 等
 * prompt 原料绝不出现在这里或 OG meta 里。
 */

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}

// generateMetadata 和 page 同一请求内各查一次，用 React cache 去重。
const getSharedCharacter = cache(getCharacterById);

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { code } = await params;
  const character = await getSharedCharacter(code);
  const rawLang = (await searchParams).lang;
  const sharedLocale = matchSupportedLocale(
    Array.isArray(rawLang) ? rawLang[0] : rawLang,
  );
  const dict = sharedLocale
    ? await getDictionary(sharedLocale)
    : await getRequestDict();

  // 不存在或 private：不泄露任何字段，回全站默认 meta。
  if (!character || character.visibility === "private") {
    return {
      title: dict.meta.title,
      description: dict.meta.description,
    };
  }

  const description =
    character.bio?.slice(0, 120) || dict.meta.description || "";
  const image = character.coverImageUrl ?? character.avatarUrl ?? undefined;

  return {
    title: `${character.name} · ${dict.shell.brand}`,
    description,
    openGraph: {
      title: `${character.name} · ${dict.shell.brand}`,
      description,
      type: "profile",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${character.name} · ${dict.shell.brand}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function CharacterSharePage({ params }: Props) {
  const { code } = await params;
  const character = await getSharedCharacter(code);
  if (!character) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 登录用户：维持原行为，直入详情页。
  if (user) redirect(`/characters/${character.id}`);

  // 访客 + private：保留原登录门禁（owner 场景），不渲染任何字段。
  if (character.visibility === "private") {
    redirect(`/signin?next=${encodeURIComponent(`/share/${character.id}`)}`);
  }

  const dict = await getRequestDict();
  const cover = character.coverImageUrl ?? character.avatarUrl;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-[var(--space-lg)] px-[var(--page-px)] py-[var(--space-3xl)]">
      <header className="flex flex-col gap-[var(--space-sm)]">
        <h1 className="hero-title text-3xl">{dict.share.inviteLine}</h1>
      </header>

      <section className="glass-card overflow-hidden">
        {cover ? (
          <div className="relative h-[220px]">
            <ImageWithFallback
              src={cover}
              alt=""
              ariaHidden
              className="h-full w-full object-cover"
              loading="eager"
              fallback={
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-display-zh text-6xl text-text-primary/20">
                    {firstChar(character.name)}
                  </span>
                </div>
              }
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-base/90" />
          </div>
        ) : (
          <div className="flex h-[160px] items-center justify-center">
            <span className="font-display-zh text-6xl text-text-primary/20">
              {firstChar(character.name)}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-[var(--space-sm)] p-[var(--space-lg)]">
          <div className="flex items-center gap-[var(--space-sm)]">
            <h2 className="font-display-zh text-2xl font-bold text-text-primary">
              {character.name}
            </h2>
            {!SFW_MODE && character.nsfw && (
              <span className="rounded-[var(--radius-sm)] border border-accent-amber/50 bg-accent-amber/10 px-[6px] py-[1px] text-[10px] font-semibold text-accent-amber">
                {dict.nsfw.badge}
              </span>
            )}
          </div>
          {character.bio && (
            <p className="text-sm leading-relaxed text-text-muted">
              {character.bio}
            </p>
          )}
          {character.tags.length > 0 && (
            <div className="flex flex-wrap gap-[var(--space-xs)]">
              {character.tags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-xs text-text-secondary"
                >
                  {localizeCharacterTag(tag, dict.characterTagLabels)}
                </span>
              ))}
            </div>
          )}
          <Link
            href={`/signin?next=${encodeURIComponent(`/share/${character.id}`)}`}
            className={`mt-[var(--space-sm)] ${btnPrimaryLg}`}
          >
            {dict.share.viewCta}
          </Link>
        </div>
      </section>
    </main>
  );
}
