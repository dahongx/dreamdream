import Link from "next/link";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/nav/BackButton";
import { PageAtmosphere } from "@/components/PageAtmosphere";
import { ShopPageClient } from "@/components/shop/ShopPageClient";
import { getRequestI18n } from "@/i18n/server";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { canClaimDailyToday } from "@/lib/currency/transactions";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/config";
import { sfwHelpLinks } from "@/lib/legal/sfw-documents";
import { sfwServiceCopy } from "@/lib/legal/sfw-service-copy";
import { getUserMembership } from "@/lib/membership/queries";

export const dynamic = "force-dynamic";

/**
 * /shop — 商城页。
 *
 * 两个一级 tab：月卡 / 金币。
 *
 * 月卡区结构（自上而下）：
 *   1. 当前月卡状态（左）+ 每日银币（右），并排两栏 grid
 *   2. 三档月卡 + 当前档位的价格与购买按钮
 *   3. 已接入权益对比表（4 列：普通 / 黄金 / 铂金 / 钻石）
 *
 * 未登录访问 → 跳 /signin?next=/shop。商城本身依赖会员状态、签到状态等用户态。
 *
 * 视觉契约（CLAUDE.md / DESIGN.md）：
 *   - hero 用衬线大标题
 *   - 卡片走 glass-card
 *   - 「呼吸点」动效仅用于 AI 生成/加载，本页购买按钮 loading 用通用 disabled 态
 */
export default async function ShopPage() {
  const userId = await getOptionalUserId();
  if (!userId) {
    redirect("/signin?next=/shop");
  }

  const { dict, locale } = await getRequestI18n();
  const [membership, claim] = await Promise.all([
    getUserMembership(userId),
    canClaimDailyToday(userId),
  ]);

  const t = dict.shop;
  const payprooTaiwan =
    process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === "payproo" &&
    process.env.PAYPROO_REGION?.trim().toLowerCase() === "tw";

  return (
    <PageAtmosphere>
      <article className="page-content-narrow mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-lg)] px-[var(--page-px)] py-[var(--page-py)]">
        <BackButton label={t.backButton} fallbackHref="/me" />
        <header className="page-hero-heading">
          <h1 className="hero-title page-hero-title">{t.pageTitle}</h1>
        </header>

        {LEGAL_PAGES_ENABLED &&
          process.env.PAYMENT_PROVIDER === "payproo" &&
          process.env.PAYPROO_ENVIRONMENT !== "production" && (
            <p className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-secondary">
              {sfwServiceCopy(locale).testPayment}
            </p>
          )}
        {LEGAL_PAGES_ENABLED && (
          <nav className="flex flex-wrap gap-x-[var(--space-lg)] gap-y-[var(--space-sm)] text-sm text-text-secondary">
            {sfwHelpLinks(locale)
              .filter((link) =>
                [
                  "/agreement/billing",
                  "/agreement/refund",
                  "/agreement/contact",
                ].includes(link.href),
              )
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="underline underline-offset-4 hover:text-text-primary"
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        )}
        <ShopPageClient
          activeTier={membership.active ? membership.tier : null}
          expiresAt={
            membership.active && membership.expiresAt
              ? membership.expiresAt.toISOString()
              : null
          }
          canClaimToday={claim.canClaim}
          currencySymbol={payprooTaiwan ? "NT$" : "HK$"}
        />
      </article>
    </PageAtmosphere>
  );
}
