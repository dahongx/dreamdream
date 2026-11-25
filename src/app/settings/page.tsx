import { eq } from "drizzle-orm";
import { BackButton } from "@/components/nav/BackButton";
import { PageAtmosphere } from "@/components/PageAtmosphere";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getRequestDict } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { firstChar } from "@/lib/util/first-char";

export const dynamic = "force-dynamic";

/**
 * /settings — minimal v1 surface. Display name (feeds {{user}}), username
 * (@-handle), email (read-only), sign out.
 *
 * Admin-only modules（usage stats / billing config / invite codes）已迁出到
 * /admin（参 src/app/admin/page.tsx）；右上角头像旁的「平台管理」入口只
 * 对 admin 显示。
 *
 * v1.5+ work: notification prefs, regex / NSFW defaults moved here from
 * cookies, account deletion.
 */
export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  const dict = await getRequestDict();
  const [me] = await db
    .select({
      email: users.email,
      phone: users.phone,
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

  const t = dict.settings;
  const displayName = me?.displayName ?? me?.name ?? "";

  return (
    <PageAtmosphere>
      <article className="page-content-narrow mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-xl)] px-[var(--page-px)] py-[var(--page-py)]">
        <BackButton label={t.backButton} fallbackHref="/me" />

        {/* hero —— DESIGN.md 签名 #1（设置页 3xl 衬线定调）。
          eyebrow/heroTitle 字典键早已备好，此前从未渲染。 */}
        <header className="page-hero-heading flex flex-col gap-[var(--space-xs)]">
          <h1 className="hero-title page-hero-title">{t.heroTitle}</h1>
        </header>

        <SettingsForm
          initialDisplayName={displayName}
          initialUsername={me?.username ?? ""}
          initialBio={me?.bio ?? ""}
          initialEmail={me?.email ?? "—"}
          initialPhone={me?.phone ?? ""}
          initialAvatarUrl={me?.avatarUrl ?? ""}
          fallbackChar={firstChar(displayName || me?.username || me?.email)}
        />

        <section className="glass-card flex items-center justify-between gap-[var(--space-md)] p-[var(--space-xl)]">
          <p className="font-display-zh text-lg text-text-primary">
            {t.signOutTitle}
          </p>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-[var(--radius-sm)] border border-semantic-error/40 px-[var(--space-md)] py-[var(--space-sm)] text-sm text-semantic-error transition-colors hover:bg-semantic-error/10"
            >
              {t.signOut}
            </button>
          </form>
        </section>
      </article>
    </PageAtmosphere>
  );
}
