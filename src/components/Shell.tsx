import { ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { NsfwToggle } from "@/components/explore/NsfwToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SfwHelpNav } from "@/components/legal/SfwHelpNav";
import { MobileTabBar } from "@/components/MobileTabBar";
import { RailNav } from "@/components/nav/RailNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { TopbarMobileMenu } from "@/components/TopbarMobileMenu";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { DailyClaimGate } from "@/components/wallet/DailyClaimGate";
import { getRequestI18n } from "@/i18n/server";
import { getViewerChromeData } from "@/lib/auth/viewer-chrome";
import { resolveShowNsfw, SFW_MODE } from "@/lib/config/site";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/config";
import { sfwHelpLinks } from "@/lib/legal/sfw-documents";
import { firstChar } from "@/lib/util/first-char";

/**
 * App-wide chrome: icon rail on the left, topbar on top, content fills the
 * rest. Visual contract per DESIGN.md (暗紫黑底色 + 低装饰密度的 chrome)。
 * Rail is decoration-light because it sits on every page —
 * icons + a thin gold underline on the active row keep it from competing with
 * the hero serifs in main content.
 *
 * NSFW toggle lives here (not on /explore) per ui-mock/variant-b.png — it's a
 * global user preference, not a page widget. We read the cookie server-side so
 * the topbar matches the same state the explore query uses.
 */

export async function Shell({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const showNsfw = resolveShowNsfw(cookieStore.get("nj_show_nsfw")?.value);
  const { dict, locale } = await getRequestI18n();
  const me = await getViewerChromeData();

  return (
    <div className="flex min-h-dvh">
      <aside
        aria-label={dict.shell.navAria}
        className="sticky top-0 hidden h-dvh w-[var(--rail-width)] shrink-0 flex-col items-center gap-[var(--space-lg)] border-r border-border-subtle bg-bg-elevated py-[var(--space-lg)] md:flex"
      >
        <Link
          href="/"
          aria-label={dict.shell.brandHomeAria}
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full transition-transform hover:scale-105"
        >
          <Image
            src="/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
            priority
          />
        </Link>
        <RailNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          id="app-topbar"
          className="app-topbar sticky top-0 z-10 flex h-[var(--topbar-height)] items-center justify-between gap-[var(--space-sm)] border-b border-border-subtle bg-bg-base/80 px-[var(--space-md)] backdrop-blur-md md:px-[var(--space-xl)]"
        >
          <Link href="/" className="app-topbar-brand shrink-0">
            <BrandLogo label={dict.shell.brand} idPrefix="shell-brand" />
          </Link>
          <div className="app-topbar-actions flex min-w-0 items-center gap-[var(--space-sm)] text-sm text-text-muted md:gap-[var(--space-lg)]">
            {me?.isAdmin && (
              <Link
                href="/admin"
                title={dict.nav.admin}
                aria-label={dict.shell.adminEntryAria}
                className="app-topbar-icon app-topbar-admin"
              >
                <ShieldCheck width={18} height={18} strokeWidth={1.5} />
              </Link>
            )}
            <div className="hidden items-center gap-[var(--space-lg)] md:flex">
              <LanguageToggle />
              {/* SFW 版没有可切换的内容分级，开关只会暴露「这里本该有成人内容」，
                  所以整块不渲染。见 src/lib/config/site.ts。 */}
              {!SFW_MODE && <NsfwToggle defaultOn={showNsfw} />}
            </div>
            <div className="md:hidden">
              <TopbarMobileMenu defaultNsfw={showNsfw} variant="ghost" />
            </div>
            {me && <NotificationBell initialItems={me.unreadNotifications} />}
            {me ? (
              <Link
                href="/settings"
                title={me.name ?? dict.nav.settings}
                aria-label={me.name ?? dict.nav.settings}
                className="app-topbar-avatar"
              >
                {me.avatarUrl ? (
                  <ImageWithFallback
                    src={me.avatarUrl}
                    alt=""
                    ariaHidden
                    className="h-full w-full object-cover"
                    fallback={
                      <span className="font-display-zh text-base text-text-muted">
                        {firstChar(me.name)}
                      </span>
                    }
                  />
                ) : (
                  <span className="font-display-zh text-base text-text-muted">
                    {firstChar(me.name)}
                  </span>
                )}
              </Link>
            ) : (
              <Link
                href="/signin"
                className="hidden transition-colors hover:text-text-primary sm:inline"
              >
                {dict.nav.signIn}
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 pb-[calc(var(--bottombar-height)+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
        {LEGAL_PAGES_ENABLED && <SfwHelpNav links={sfwHelpLinks(locale)} />}
      </div>
      <MobileTabBar />
      {me && <DailyClaimGate />}
    </div>
  );
}
