import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AdminAnnouncementsSection } from "@/components/notifications/AdminAnnouncementsSection";
import { PageAtmosphere } from "@/components/PageAtmosphere";
import { AdminBillingSection } from "@/components/settings/AdminBillingSection";
import { AdminInviteSection } from "@/components/settings/AdminInviteSection";
import { AdminModelStatusSection } from "@/components/settings/AdminModelStatusSection";
import { AdminRechargeSection } from "@/components/settings/AdminRechargeSection";
import { AdminUsageSection } from "@/components/settings/AdminUsageSection";
import { AdminUsersSection } from "@/components/settings/AdminUsersSection";
import { TabNavLink } from "@/components/ui/TabNav";
import { getRequestDict } from "@/i18n/server";
import { getAllModelsHealthStatus } from "@/lib/ai/health-check";
import { getUserDailyUsage, listUserAnalytics } from "@/lib/analytics/users";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { listModelPrices } from "@/lib/billing/admin";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { listInviteCodes } from "@/lib/invite/admin";
import { listAnnouncements } from "@/lib/notifications/admin";
import {
  getAdminUsageStats,
  getDailyModelUsage,
  todayInShanghai,
} from "@/lib/usage/stats";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const TABS = [
  "usage",
  "billing",
  "invite",
  "users",
  "recharge",
  "announcements",
  "models",
] as const;
type AdminTab = (typeof TABS)[number];

function parseTab(raw: string | undefined): AdminTab {
  return (TABS as readonly string[]).includes(raw ?? "")
    ? (raw as AdminTab)
    : "usage";
}

interface AdminPageProps {
  // dailyDate 是 Users tab 表 2 的初始日期（Shanghai 时区 YYYY-MM-DD）。
  // 与 endDate 区分，是因为 endDate 是 Usage tab 7 日趋势的窗口右边界，
  // 语义不同，URL 上各占各的 key。
  searchParams?: Promise<{
    tab?: string;
    endDate?: string;
    dailyDate?: string;
  }>;
}

/**
 * /admin — 平台管理（admin-only）。把 usage / billing / invite 三块从
 * /settings 抽出来，单独分 3 个 tab。普通用户访问会拿到 notFound() —— 不
 * 暴露这个 route 的存在，比 403 更干净。
 *
 * Tab 状态用 URL `?tab=` 持久化（与 /packs 同模式），刷新和分享都保留。
 * `?endDate=` 透传给 Usage tab 的日趋势组件，沿用原 /settings 的契约。
 */
export default async function AdminPage({ searchParams }: AdminPageProps) {
  const userId = await getCurrentUserId();
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // 非管理员直接 404 —— /admin 是隐藏入口，普通用户不应感知到它存在。
  if (me?.role !== "admin") {
    notFound();
  }

  const params = searchParams ? await searchParams : {};
  const tab = parseTab(params.tab);
  const todayShanghai = todayInShanghai();
  const requestedEndDate =
    params.endDate && DATE_RE.test(params.endDate) ? params.endDate : null;
  const dailyEndDate =
    requestedEndDate && requestedEndDate <= todayShanghai
      ? requestedEndDate
      : todayShanghai;
  // Users tab 的"按日"日期。未传或非法格式 → 今日 Shanghai；未来日期 → clamp 到今日。
  const requestedDailyDate =
    params.dailyDate && DATE_RE.test(params.dailyDate)
      ? params.dailyDate
      : null;
  const usersDailyDate =
    requestedDailyDate && requestedDailyDate <= todayShanghai
      ? requestedDailyDate
      : todayShanghai;

  const dict = await getRequestDict();
  const t = dict.admin;

  // 只取当前 tab 需要的数据。各 tab 独立 query，按需加载减少切 tab 时的
  // 服务端负担（每次 RSC 重渲一次）。
  const usageData =
    tab === "usage"
      ? await Promise.all([
          getAdminUsageStats(),
          getDailyModelUsage(dailyEndDate, 7),
        ])
      : null;
  const modelPrices = tab === "billing" ? await listModelPrices() : [];
  const inviteCodes = tab === "invite" ? await listInviteCodes() : [];
  const usersData =
    tab === "users"
      ? await Promise.all([
          listUserAnalytics(),
          getUserDailyUsage(usersDailyDate),
        ])
      : null;
  const modelStatus = tab === "models" ? await getAllModelsHealthStatus() : [];
  const announcements =
    tab === "announcements" ? await listAnnouncements() : [];

  const tabLabel: Record<AdminTab, string> = {
    usage: t.tabUsage,
    billing: t.tabBilling,
    invite: t.tabInvite,
    users: t.tabUsers,
    recharge: t.tabRecharge,
    announcements: t.tabAnnouncements,
    models: t.tabModels ?? "模型状态",
  };

  return (
    <PageAtmosphere>
      <article className="page-content-wide mx-auto flex w-full max-w-5xl flex-col gap-[var(--space-xl)] px-[var(--page-px)] py-[var(--page-py)]">
        <header className="page-hero-heading">
          <h1 className="hero-title page-hero-title">{t.heroTitle}</h1>
        </header>

        {/* Tabs — 同 /packs 视觉契约（底部金边 active），URL 持久化。 */}
        <div className="flex gap-[var(--space-lg)] border-b border-border-subtle">
          {TABS.map((key) => {
            const isActive = tab === key;
            // 每个 tab 只带自己关心的 query param：usage→endDate, users→dailyDate。
            // 切 tab 时不串味，避免 ?endDate= 跟着切到 invite 这种无意义场景。
            const qs = new URLSearchParams({ tab: key });
            if (key === "usage" && requestedEndDate) {
              qs.set("endDate", requestedEndDate);
            }
            if (key === "users" && requestedDailyDate) {
              qs.set("dailyDate", requestedDailyDate);
            }
            const href = `/admin?${qs.toString()}`;
            return (
              <TabNavLink key={key} href={href} active={isActive} size="md">
                {tabLabel[key]}
              </TabNavLink>
            );
          })}
        </div>

        {tab === "usage" && usageData && (
          <AdminUsageSection
            stats={usageData[0]}
            dailyUsage={usageData[1]}
            dailyEndDate={dailyEndDate}
            dailyMaxEndDate={todayShanghai}
          />
        )}
        {tab === "billing" && <AdminBillingSection prices={modelPrices} />}
        {tab === "invite" && <AdminInviteSection codes={inviteCodes} />}
        {tab === "users" && usersData && (
          <AdminUsersSection
            summaryRows={usersData[0]}
            initialDailyDate={usersDailyDate}
            initialDailyRows={usersData[1]}
            maxDate={todayShanghai}
          />
        )}
        {tab === "recharge" && <AdminRechargeSection />}
        {tab === "announcements" && (
          <AdminAnnouncementsSection announcements={announcements} />
        )}
        {tab === "models" && <AdminModelStatusSection models={modelStatus} />}
      </article>
    </PageAtmosphere>
  );
}
