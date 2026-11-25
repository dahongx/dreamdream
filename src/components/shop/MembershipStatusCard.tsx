"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type { MembershipTier } from "@/lib/membership/constants";

interface Props {
  activeTier: MembershipTier | null;
  /** ISO 字符串；仅 active 时有意义。 */
  expiresAt: string | null;
}

/**
 * 只展示当前有效月卡；未购买时显示单一空状态。
 * 其它档位属于购买选项，不应伪装成待「解锁」的账户状态。
 */
export function MembershipStatusCard({ activeTier, expiresAt }: Props) {
  const { dict, locale } = useI18n();
  const t = dict.shop;

  const tierLabel: Record<MembershipTier, string> = {
    gold: t.tierGoldName,
    platinum: t.tierPlatinumName,
    diamond: t.tierDiamondName,
  };

  const expiry = expiresAt ? formatExpiry(expiresAt, locale) : null;

  return (
    <section
      id="nj_shop_membership_status"
      className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]"
    >
      <header className="text-sm text-text-muted">{t.statusCardTitle}</header>
      {activeTier && expiry ? (
        <>
          <div className="flex items-center gap-[var(--space-sm)] rounded-[var(--radius-md)] border border-accent-primary/50 bg-accent-primary/10 px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-primary">
            <Check
              size={14}
              className="text-accent-primary"
              strokeWidth={2.2}
            />
            {tierLabel[activeTier]}
          </div>
          <footer className="text-xs text-text-muted">
            {t.statusExpiresPrefix}
            {expiry}
            {t.statusExpiresSuffix}
          </footer>
        </>
      ) : (
        <p className="text-sm text-text-muted">{t.statusNoActive}</p>
      )}
    </section>
  );
}

function formatExpiry(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
