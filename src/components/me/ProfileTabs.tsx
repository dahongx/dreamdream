"use client";

import Link from "next/link";
import { useState } from "react";
import { CharacterGridCard } from "@/components/characters/CharacterGridCard";
import { CreatorEarningsPanel } from "@/components/me/CreatorEarningsPanel";
import { TabNavButton } from "@/components/ui/TabNav";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/types";
import type {
  CreatorEarningDetailRow,
  CreatorEarningsOverview,
} from "@/lib/creator/queries";
import type {
  CurrencyTransactionRecord,
  UserWalletInfo,
} from "@/lib/wallet/queries";

export interface ProfileCharacterItem {
  id: string;
  name: string;
  bio: string | null;
  coverImageUrl: string | null;
  avatarUrl: string | null;
  conversationCount: number;
  nsfw: boolean;
  visibility: "public" | "private" | "unlisted";
}

interface Props {
  characters: ReadonlyArray<ProfileCharacterItem>;
  walletInfo: UserWalletInfo;
  currencyTransactions: ReadonlyArray<CurrencyTransactionRecord>;
  earningsOverview: CreatorEarningsOverview;
  earningsDetails: ReadonlyArray<CreatorEarningDetailRow>;
}

type Tab = "wallet" | "characters" | "earnings";
type WalletSubTab = "usage" | "recharge";

function walletEventLabel(
  record: CurrencyTransactionRecord,
  t: Dict["me"],
): string {
  switch (record.eventKind) {
    case "daily_claim":
      return t.walletEventDailyClaim;
    case "recharge":
      return t.walletEventRecharge;
    case "chat":
      return record.characterName
        ? t.walletEventChatFmt.replace("{name}", record.characterName)
        : t.walletEventChat;
    case "continue":
      return record.characterName
        ? t.walletEventContinueFmt.replace("{name}", record.characterName)
        : t.walletEventContinue;
    case "pack":
      return t.walletEventPack;
    case "image":
      return t.walletEventImage;
    case "refund":
      return t.walletEventRefund;
    case "model_usage":
      return t.walletEventModelUsage;
  }
}

/**
 * 个人主页底部双 tab —— 钱包 vs 角色。
 *
 * 钱包 tab 包含：会员信息、剩余口粮、货币消耗和充值记录两个子 tab。
 * 角色 tab 复用 /mine 的同一份数据，但样式更紧凑。
 */
export function ProfileTabs({
  characters,
  walletInfo,
  currencyTransactions,
  earningsOverview,
  earningsDetails,
}: Props) {
  const { dict } = useI18n();
  const [tab, setTab] = useState<Tab>("wallet");
  const [walletSubTab, setWalletSubTab] = useState<WalletSubTab>("usage");
  const t = dict.me;

  return (
    <section className="flex flex-col gap-[var(--space-md)]">
      {/* 主 tab —— 全站统一短线式（原胶囊填充式已收敛，胶囊留给筛选语义） */}
      <nav className="flex items-center gap-[var(--space-lg)] border-b border-border-subtle">
        <TabNavButton
          active={tab === "wallet"}
          size="md"
          onClick={() => setTab("wallet")}
        >
          {t.tabWallet}
        </TabNavButton>
        <TabNavButton
          active={tab === "characters"}
          size="md"
          onClick={() => setTab("characters")}
        >
          {t.tabCharacters}
        </TabNavButton>
        <TabNavButton
          active={tab === "earnings"}
          size="md"
          onClick={() => setTab("earnings")}
        >
          {t.tabEarnings}
        </TabNavButton>
      </nav>

      {tab === "wallet" ? (
        <WalletContent
          walletInfo={walletInfo}
          currencyTransactions={currencyTransactions}
          subTab={walletSubTab}
          onSubTabChange={setWalletSubTab}
        />
      ) : tab === "earnings" ? (
        <CreatorEarningsPanel
          overview={earningsOverview}
          details={earningsDetails}
        />
      ) : characters.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-[var(--space-sm)] p-[var(--space-2xl)] text-center">
          <p className="font-display-zh text-xl text-text-primary">
            {t.charactersEmptyTitle}
          </p>
          <p className="max-w-md text-xs text-text-muted">
            {t.charactersEmptyHint}
          </p>
          <Link
            href="/create/character"
            className="mt-[var(--space-sm)] rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-xs)] text-base font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
          >
            {t.charactersEmptyCta}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-[var(--space-sm)] sm:grid-cols-3 md:grid-cols-4">
          {/* 之前这份手写卡掉了 R18/可见性角标（数据查了没渲染），
              换共享组件后与全站角色卡观感一致 */}
          {characters.map((c) => (
            <CharacterGridCard
              key={c.id}
              character={c}
              dict={dict}
              variant="profile"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WalletContent({
  walletInfo,
  currencyTransactions,
  subTab,
  onSubTabChange,
}: {
  walletInfo: UserWalletInfo;
  currencyTransactions: ReadonlyArray<CurrencyTransactionRecord>;
  subTab: WalletSubTab;
  onSubTabChange: (tab: WalletSubTab) => void;
}) {
  const { dict, locale } = useI18n();
  const t = dict.me;

  // 格式化会员等级
  const tierLabel = (() => {
    // 优先显示特殊身份
    if (walletInfo.role === "admin") return dict.quota.tierAdmin;
    if (walletInfo.role === "beta_tester") return dict.quota.tierBetaTester;

    // 检查是否有有效的会员等级
    if (walletInfo.membershipTier && walletInfo.membershipExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(walletInfo.membershipExpiresAt);
      if (expiresAt > now) {
        // 会员仍在有效期内 —— v2「一盏灯」重构：拿掉 emoji 前缀
        // （DESIGN.md「不要 emoji 当 icon」），色彩语义由外层容器承担
        if (walletInfo.membershipTier === "diamond")
          return dict.shop.tierDiamondName;
        if (walletInfo.membershipTier === "platinum")
          return dict.shop.tierPlatinumName;
        if (walletInfo.membershipTier === "gold") return dict.shop.tierGoldName;
      }
    }

    return dict.quota.tierRegular;
  })();

  // 会员到期时间显示
  const expiryLabel = (() => {
    if (walletInfo.role === "admin" || walletInfo.role === "beta_tester") {
      return t.walletMembershipNoExpiry;
    }

    if (walletInfo.membershipTier && walletInfo.membershipExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(walletInfo.membershipExpiresAt);
      if (expiresAt > now) {
        return expiresAt.toLocaleDateString(locale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      }
    }

    return t.walletMembershipNoExpiry;
  })();

  // 格式化时间
  const formatDateTime = (date: Date): string => {
    return new Date(date).toLocaleString(locale, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {/* 会员信息 + 剩余口粮 */}
      <div className="grid gap-[var(--space-sm)] sm:grid-cols-2">
        {/* 会员信息 */}
        <div className="glass-card flex flex-col gap-[var(--space-sm)] p-[var(--space-lg)]">
          <h3 className="font-display-zh text-lg text-text-primary">
            {t.walletMembershipTitle}
          </h3>
          <div className="flex flex-col gap-[var(--space-xs)] text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">{t.walletMembershipTier}</span>
              <span className="text-text-primary">{tierLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">
                {t.walletMembershipExpiry}
              </span>
              <span className="text-text-primary">{expiryLabel}</span>
            </div>
          </div>
        </div>

        {/* 剩余口粮 */}
        <div className="glass-card flex flex-col gap-[var(--space-sm)] p-[var(--space-lg)]">
          <h3 className="font-display-zh text-lg text-text-primary">
            {t.walletBalanceTitle}
          </h3>
          <div className="flex flex-col gap-[var(--space-xs)] text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">{t.walletGoldBalance}</span>
              <span className="font-mono text-lg font-semibold text-currency-gold">
                {walletInfo.goldBalance}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">{t.walletSilverBalance}</span>
              <span className="font-mono text-lg font-semibold text-currency-silver">
                {walletInfo.silverBalance}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 货币消耗 / 充值记录 子 tab */}
      <div className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]">
        <div className="flex gap-[var(--space-sm)] border-b border-border-subtle">
          <SubTabButton
            active={subTab === "usage"}
            label={t.walletTabUsage}
            onClick={() => onSubTabChange("usage")}
          />
          <SubTabButton
            active={subTab === "recharge"}
            label={t.walletTabRecharge}
            onClick={() => onSubTabChange("recharge")}
          />
        </div>

        {subTab === "usage" ? (
          currencyTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-[var(--space-sm)] py-[var(--space-2xl)] text-center">
              <p className="text-sm text-text-muted">{t.walletUsageEmpty}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--space-xs)]">
              {/* 表头 */}
              <div className="grid grid-cols-[1.6fr_2.4fr_1.6fr_0.8fr_0.8fr] gap-[var(--space-sm)] border-b border-border-subtle pb-[var(--space-xs)] text-xs font-medium text-text-muted">
                <span>{t.walletUsageColTime}</span>
                <span>{t.walletUsageColEvent}</span>
                <span>{t.walletUsageColModel}</span>
                <span className="text-right text-currency-gold">
                  {t.walletUsageColGold}
                </span>
                <span className="text-right text-currency-silver">
                  {t.walletUsageColSilver}
                </span>
              </div>
              {/* 数据行 */}
              <div className="flex max-h-[400px] flex-col gap-[var(--space-xs)] overflow-y-auto">
                {currencyTransactions.map((record) => (
                  <div
                    key={record.id}
                    className="grid grid-cols-[1.6fr_2.4fr_1.6fr_0.8fr_0.8fr] gap-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary"
                  >
                    <span className="truncate">
                      {formatDateTime(record.createdAt)}
                    </span>
                    <span className="truncate">
                      {walletEventLabel(record, t)}
                    </span>
                    <span
                      className="truncate text-text-muted"
                      title={record.model ?? undefined}
                    >
                      {record.model ?? "—"}
                    </span>
                    <span className="text-right font-mono text-currency-gold">
                      {record.goldAmount !== 0
                        ? record.goldAmount > 0
                          ? `+${record.goldAmount}`
                          : record.goldAmount
                        : "—"}
                    </span>
                    <span className="text-right font-mono text-currency-silver">
                      {record.silverAmount !== 0
                        ? record.silverAmount > 0
                          ? `+${record.silverAmount}`
                          : record.silverAmount
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
              {/* 总计 */}
              <div className="mt-[var(--space-sm)] grid grid-cols-[1.6fr_2.4fr_1.6fr_0.8fr_0.8fr] gap-[var(--space-sm)] border-t border-border-subtle pt-[var(--space-sm)] text-sm">
                <span className="col-span-3 font-medium text-text-primary">
                  {t.walletCurrentBalance}
                </span>
                <span className="text-right font-mono font-semibold text-currency-gold">
                  {walletInfo.goldBalance}
                </span>
                <span className="text-right font-mono font-semibold text-currency-silver">
                  {walletInfo.silverBalance}
                </span>
              </div>
            </div>
          )
        ) : (
          (() => {
            // 过滤出充值记录（仅 recharge：购买会员、金币包）
            const rechargeRecords = currencyTransactions.filter(
              (r) => r.transactionType === "recharge",
            );

            return rechargeRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-[var(--space-sm)] py-[var(--space-2xl)] text-center">
                <p className="text-sm text-text-muted">
                  {t.walletRechargeEmpty}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--space-xs)]">
                {/* 表头 */}
                <div className="grid grid-cols-[1.6fr_2.4fr_0.8fr_0.8fr] gap-[var(--space-sm)] border-b border-border-subtle pb-[var(--space-xs)] text-xs font-medium text-text-muted">
                  <span>{t.walletUsageColTime}</span>
                  <span>{t.walletUsageColEvent}</span>
                  <span className="text-right text-currency-gold">
                    {t.walletUsageColGold}
                  </span>
                  <span className="text-right text-currency-silver">
                    {t.walletUsageColSilver}
                  </span>
                </div>
                {/* 数据行 */}
                <div className="flex max-h-[400px] flex-col gap-[var(--space-xs)] overflow-y-auto">
                  {rechargeRecords.map((record) => (
                    <div
                      key={record.id}
                      className="grid grid-cols-[1.6fr_2.4fr_0.8fr_0.8fr] gap-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary"
                    >
                      <span className="truncate">
                        {formatDateTime(record.createdAt)}
                      </span>
                      <span className="truncate">
                        {walletEventLabel(record, t)}
                      </span>
                      <span className="text-right font-mono text-currency-gold">
                        {record.goldAmount !== 0
                          ? record.goldAmount > 0
                            ? `+${record.goldAmount}`
                            : record.goldAmount
                          : "—"}
                      </span>
                      <span className="text-right font-mono text-currency-silver">
                        {record.silverAmount !== 0
                          ? record.silverAmount > 0
                            ? `+${record.silverAmount}`
                            : record.silverAmount
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

function SubTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border-b-2 px-[var(--space-sm)] pb-[var(--space-xs)] text-sm font-medium transition-colors ${
        active
          ? "border-accent-primary text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}
