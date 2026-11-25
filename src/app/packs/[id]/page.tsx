import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/nav/BackButton";
import { OpeningComponentList } from "@/components/opening/OpeningComponentList";
import { DeletePackButton } from "@/components/packs/DeletePackButton";
import { PackPreview } from "@/components/packs/PackPreview";
import { SubscribeToCharacterButton } from "@/components/packs/SubscribeToCharacterButton";
import { RegexRuleList } from "@/components/regex/RegexRuleList";
import { getRequestDict } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { listMyCharacters } from "@/lib/characters/queries";
import { listOwnedPackOpeningComponents } from "@/lib/opening/queries";
import { canEditPack } from "@/lib/packs/permissions";
import { getPack } from "@/lib/packs/queries";
import { listPackRules } from "@/lib/regex/queries";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PackDetailPage({ params }: Props) {
  const { id } = await params;
  const dict = await getRequestDict();
  const [pack, rules, userId] = await Promise.all([
    getPack(id, dict.packs),
    listPackRules(id, dict),
    getCurrentUserId(),
  ]);
  if (!pack) notFound();
  if (!pack.isPublic && pack.ownerUserId !== userId) notFound();

  const isOwner = canEditPack(pack, userId);
  const openingComponents = isOwner
    ? await listOwnedPackOpeningComponents(id, userId)
    : [];
  const canSubscribe =
    !isOwner && (pack.isPublic || pack.ownerUserId === userId);
  const myCharacters = canSubscribe
    ? (await listMyCharacters(userId)).map((c) => ({ id: c.id, name: c.name }))
    : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-[var(--page-px)] py-[var(--space-lg)]">
      {/* 返回按钮 —— 顶部固定位置, 走 router.back(); 直链打开 fallback 到 /create?tab=packs */}
      <BackButton
        label={dict.packs.detailBack}
        fallbackHref="/create?tab=packs"
      />
      <header className="mb-[var(--space-sm)] mt-[var(--space-md)] flex flex-col gap-[var(--space-sm)] md:mb-[var(--space-md)] md:flex-row md:flex-wrap md:items-start md:justify-between">
        <div>
          <h1 className="hero-title">{pack.name}</h1>
          {pack.description && (
            <p className="mt-[var(--space-sm)] max-w-2xl text-sm text-text-secondary">
              {pack.description}
            </p>
          )}
          <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-xs)]">
            {pack.isPublic && (
              <span className="rounded-[var(--radius-pill)] bg-accent-primary/10 px-[var(--space-sm)] py-[1px] text-[10px] text-accent-primary">
                {dict.packs.publicBadge}
              </span>
            )}
            {pack.globalCss && (
              <span className="rounded-[var(--radius-pill)] bg-surface-glass px-[var(--space-sm)] py-[1px] text-[10px] text-text-muted">
                {dict.packs.cssBadge}
              </span>
            )}
            <span className="rounded-[var(--radius-pill)] bg-surface-glass px-[var(--space-sm)] py-[1px] text-[10px] text-text-muted">
              {pack.subscriberCount}
              {dict.packs.subscriberCountSuffix}
            </span>
            <span className="rounded-[var(--radius-pill)] bg-surface-glass px-[var(--space-sm)] py-[1px] text-[10px] text-text-muted">
              {rules.length}
              {dict.packs.ruleCountSuffix}
            </span>
            {isOwner && openingComponents.length > 0 && (
              <span className="rounded-[var(--radius-pill)] bg-surface-glass px-[var(--space-sm)] py-[1px] text-[10px] text-text-muted">
                {openingComponents.length}
                {dict.opening.countSuffix}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-[var(--space-sm)]">
          {isOwner && (
            <>
              <DeletePackButton packId={pack.id} packName={pack.name} />
              <Link
                href={`/packs/${pack.id}/studio`}
                className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-base font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
              >
                {dict.packs.detailEnterStudio}
              </Link>
            </>
          )}
          {canSubscribe && myCharacters.length > 0 && (
            <SubscribeToCharacterButton
              packId={pack.id}
              myCharacters={myCharacters}
            />
          )}
        </div>
      </header>

      <section>
        <PackPreview
          packId={pack.id}
          packName={pack.name}
          globalCss={pack.globalCss ?? ""}
          rules={rules}
          openingComponents={isOwner ? openingComponents : []}
        />
      </section>

      {isOwner && (
        <section className="mt-[var(--space-lg)]">
          <h2 className="mb-[var(--space-md)] font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            {dict.packs.detailPreviewRulesLegend}
          </h2>
          {/* Keep the existing owner-only raw editor reachable. Studio's edit
              override opens an AI draft, which cannot inspect a saved rule. */}
          <RegexRuleList packId={pack.id} rules={rules} variant="compact" />
        </section>
      )}

      {isOwner && (
        <section className="mt-[var(--space-lg)]">
          <h2 className="mb-[var(--space-xs)] font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            {dict.opening.sectionTitle}
          </h2>
          <p className="mb-[var(--space-md)] text-xs text-text-muted">
            {dict.packs.openingPrivateNotice}
          </p>
          <OpeningComponentList
            packId={pack.id}
            components={openingComponents}
          />
        </section>
      )}
    </div>
  );
}
