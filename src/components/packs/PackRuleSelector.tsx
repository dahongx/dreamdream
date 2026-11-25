"use client";

import * as Switch from "@radix-ui/react-switch";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import type {
  BeautificationPack,
  OpeningComponent,
  RegexRule,
} from "@/lib/db/schema";
import { extractOpeningSlots } from "@/lib/opening/content";

interface Props {
  availablePacks: BeautificationPack[];
  packRules: Record<string, RegexRule[]>;
  /** Source of truth: which rule ids are currently enabled for the character. */
  selectedRuleIds: Set<string>;
  /** Called when the user toggles a rule. Parent decides whether to persist immediately. */
  onToggle: (packId: string, ruleId: string, enabled: boolean) => void;
  /** Set true to disable inputs while a network request is in flight. */
  pending?: boolean;
  /** Pack ids to mark as official (rendered with the "官方" badge). */
  officialPackIds?: Set<string>;
  /** Current viewer's user id. Used to decide which pack rows show
   *  the "Open Studio →" jump-out link (only packs the viewer owns) and
   *  to split packs into "我的包" / "公开包" groups. */
  currentUserId?: string;
  /** When set, the studio jump-out link appends `?returnTo=<this>` so the
   *  studio's back button lands the user where they came from. Caller is
   *  responsible for passing the current pathname (or any valid internal
   *  path). Omit to fall through to the studio page's default fallback. */
  studioReturnTo?: string;
  /** Pack ids whose globalCss is currently applied to the character.
   *  Each pack with a non-empty globalCss renders a switch row that toggles
   *  this independently of the pack's rules. */
  cssEnabledPackIds?: Set<string>;
  /** Called when the user toggles a pack's globalCss row. */
  onCssToggle?: (packId: string, enabled: boolean) => void;
  /** Map of packId → that pack's opening components (enabled ones, ordered). */
  packOpeningComponents?: Record<string, OpeningComponent[]>;
  /** Opening component ids currently enabled for the character. */
  selectedOpeningIds?: Set<string>;
  /** Called when the user toggles a single opening component. */
  onOpeningComponentToggle?: (
    packId: string,
    componentId: string,
    enabled: boolean,
  ) => void;
  /** Per-component slot values: { [componentId]: { [slotKey]: value } }. */
  openingSlotValues?: Record<string, Record<string, string>>;
  /** Called when the user edits a slot input (persist on blur). */
  onOpeningSlotChange?: (
    componentId: string,
    slotKey: string,
    value: string,
  ) => void;
  /** False in create mode — slot inputs are hidden until the character exists. */
  slotEditingEnabled?: boolean;
}

const switchRootCls = `
  shrink-0 relative inline-flex h-6 w-11 cursor-pointer items-center
  rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass
  transition-colors duration-[var(--dur-short)]
  data-[state=checked]:border-accent-primary
  data-[state=checked]:bg-accent-primary
  data-[state=checked]:shadow-(--glow-accent)
  disabled:opacity-60
`;
const switchThumbCls = `
  block h-[18px] w-[18px] translate-x-[3px] rounded-full
  bg-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.5)]
  transition-transform duration-[var(--dur-short)] will-change-transform
  data-[state=checked]:translate-x-[22px]
`;

export function PackRuleSelector({
  availablePacks,
  packRules,
  selectedRuleIds,
  onToggle,
  pending = false,
  officialPackIds,
  currentUserId,
  studioReturnTo,
  cssEnabledPackIds,
  onCssToggle,
  packOpeningComponents,
  selectedOpeningIds,
  onOpeningComponentToggle,
  openingSlotValues,
  onOpeningSlotChange,
  slotEditingEnabled = true,
}: Props) {
  const { dict } = useI18n();
  const t = dict.packs;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(packId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  }

  // Search filter: matches pack.name, pack.description, rule.name, rule.outputGuidance.
  const trimmedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!trimmedQuery) return availablePacks;
    return availablePacks.filter((pack) => {
      if (
        pack.name.toLowerCase().includes(trimmedQuery) ||
        (pack.description ?? "").toLowerCase().includes(trimmedQuery)
      )
        return true;
      const rules = packRules[pack.id] ?? [];
      return rules.some(
        (r) =>
          r.name.toLowerCase().includes(trimmedQuery) ||
          (r.outputGuidance ?? "").toLowerCase().includes(trimmedQuery),
      );
    });
  }, [trimmedQuery, availablePacks, packRules]);

  if (availablePacks.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-border-subtle bg-bg-elevated/60 p-[var(--space-lg)] text-sm text-text-muted">
        {t.selectorNoPacks}
        <Link
          href="/create/pack"
          target="_blank"
          className="ml-[var(--space-xs)] text-accent-primary hover:underline"
        >
          {t.selectorCreatePack}
        </Link>
      </div>
    );
  }

  const mine = filtered.filter(
    (p) => currentUserId !== undefined && p.ownerUserId === currentUserId,
  );
  const publics = filtered.filter(
    (p) => currentUserId === undefined || p.ownerUserId !== currentUserId,
  );

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.selectorSearchPlaceholder}
        className="w-full rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
      />

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-border-subtle bg-bg-elevated/60 p-[var(--space-lg)] text-center text-sm text-text-muted">
          {t.selectorEmptySearch}
        </div>
      ) : (
        <>
          {mine.length > 0 && (
            <PackGroup
              title={t.selectorGroupMine}
              count={mine.length}
              packs={mine}
              packRules={packRules}
              expanded={expanded}
              selectedRuleIds={selectedRuleIds}
              cssEnabledPackIds={cssEnabledPackIds}
              officialPackIds={officialPackIds}
              currentUserId={currentUserId}
              studioReturnTo={studioReturnTo}
              pending={pending}
              forceExpand={trimmedQuery.length > 0}
              onToggleCollapse={toggleExpanded}
              onRuleToggle={onToggle}
              onCssToggle={onCssToggle}
              packOpeningComponents={packOpeningComponents}
              selectedOpeningIds={selectedOpeningIds}
              onOpeningComponentToggle={onOpeningComponentToggle}
              openingSlotValues={openingSlotValues}
              onOpeningSlotChange={onOpeningSlotChange}
              slotEditingEnabled={slotEditingEnabled}
            />
          )}
          {publics.length > 0 && (
            <PackGroup
              title={t.selectorGroupPublic}
              count={publics.length}
              packs={publics}
              packRules={packRules}
              expanded={expanded}
              selectedRuleIds={selectedRuleIds}
              cssEnabledPackIds={cssEnabledPackIds}
              officialPackIds={officialPackIds}
              currentUserId={currentUserId}
              studioReturnTo={studioReturnTo}
              pending={pending}
              forceExpand={trimmedQuery.length > 0}
              onToggleCollapse={toggleExpanded}
              onRuleToggle={onToggle}
              onCssToggle={onCssToggle}
              packOpeningComponents={packOpeningComponents}
              selectedOpeningIds={selectedOpeningIds}
              onOpeningComponentToggle={onOpeningComponentToggle}
              openingSlotValues={openingSlotValues}
              onOpeningSlotChange={onOpeningSlotChange}
              slotEditingEnabled={slotEditingEnabled}
            />
          )}
        </>
      )}
    </div>
  );
}

interface PackGroupProps {
  title: string;
  count: number;
  packs: BeautificationPack[];
  packRules: Record<string, RegexRule[]>;
  expanded: Set<string>;
  selectedRuleIds: Set<string>;
  cssEnabledPackIds?: Set<string>;
  officialPackIds?: Set<string>;
  currentUserId?: string;
  studioReturnTo?: string;
  pending: boolean;
  forceExpand: boolean;
  onToggleCollapse: (packId: string) => void;
  onRuleToggle: (packId: string, ruleId: string, enabled: boolean) => void;
  onCssToggle?: (packId: string, enabled: boolean) => void;
  packOpeningComponents?: Record<string, OpeningComponent[]>;
  selectedOpeningIds?: Set<string>;
  onOpeningComponentToggle?: (
    packId: string,
    componentId: string,
    enabled: boolean,
  ) => void;
  openingSlotValues?: Record<string, Record<string, string>>;
  onOpeningSlotChange?: (
    componentId: string,
    slotKey: string,
    value: string,
  ) => void;
  slotEditingEnabled: boolean;
}

function PackGroup({
  title,
  count,
  packs,
  packRules,
  expanded,
  selectedRuleIds,
  cssEnabledPackIds,
  officialPackIds,
  currentUserId,
  studioReturnTo,
  pending,
  forceExpand,
  onToggleCollapse,
  onRuleToggle,
  onCssToggle,
  packOpeningComponents,
  selectedOpeningIds,
  onOpeningComponentToggle,
  openingSlotValues,
  onOpeningSlotChange,
  slotEditingEnabled,
}: PackGroupProps) {
  return (
    <section className="flex flex-col gap-[var(--space-sm)]">
      <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
        {title} ({count})
      </h3>
      {packs.map((pack) => (
        <PackCard
          key={pack.id}
          pack={pack}
          rules={packRules[pack.id] ?? []}
          collapsed={!forceExpand && !expanded.has(pack.id)}
          selectedRuleIds={selectedRuleIds}
          cssEnabled={
            Boolean(pack.globalCss?.trim()) &&
            cssEnabledPackIds?.has(pack.id) === true
          }
          isOfficial={officialPackIds?.has(pack.id) === true}
          currentUserId={currentUserId}
          studioReturnTo={studioReturnTo}
          pending={pending}
          onToggleCollapse={() => onToggleCollapse(pack.id)}
          onRuleToggle={(ruleId, enable) =>
            onRuleToggle(pack.id, ruleId, enable)
          }
          onCssToggle={
            onCssToggle ? (enable) => onCssToggle(pack.id, enable) : undefined
          }
          openingComponents={packOpeningComponents?.[pack.id] ?? []}
          selectedOpeningIds={selectedOpeningIds}
          onOpeningComponentToggle={
            onOpeningComponentToggle
              ? (componentId, enable) =>
                  onOpeningComponentToggle(pack.id, componentId, enable)
              : undefined
          }
          openingSlotValues={openingSlotValues}
          onOpeningSlotChange={onOpeningSlotChange}
          slotEditingEnabled={slotEditingEnabled}
        />
      ))}
    </section>
  );
}

interface PackCardProps {
  pack: BeautificationPack;
  rules: RegexRule[];
  collapsed: boolean;
  selectedRuleIds: Set<string>;
  cssEnabled: boolean;
  isOfficial: boolean;
  currentUserId?: string;
  studioReturnTo?: string;
  pending: boolean;
  onToggleCollapse: () => void;
  onRuleToggle: (ruleId: string, enabled: boolean) => void;
  onCssToggle?: (enabled: boolean) => void;
  openingComponents: OpeningComponent[];
  selectedOpeningIds?: Set<string>;
  onOpeningComponentToggle?: (componentId: string, enabled: boolean) => void;
  openingSlotValues?: Record<string, Record<string, string>>;
  onOpeningSlotChange?: (
    componentId: string,
    slotKey: string,
    value: string,
  ) => void;
  slotEditingEnabled: boolean;
}

function PackCard({
  pack,
  rules,
  collapsed,
  selectedRuleIds,
  cssEnabled,
  isOfficial,
  currentUserId,
  studioReturnTo,
  pending,
  onToggleCollapse,
  onRuleToggle,
  onCssToggle,
  openingComponents,
  selectedOpeningIds,
  onOpeningComponentToggle,
  openingSlotValues,
  onOpeningSlotChange,
  slotEditingEnabled,
}: PackCardProps) {
  const { dict } = useI18n();
  const t = dict.packs;
  const enabledCount = rules.reduce(
    (acc, r) => acc + (selectedRuleIds.has(r.id) ? 1 : 0),
    0,
  );
  const enabledOpeningCount = openingComponents.reduce(
    (acc, c) => acc + (selectedOpeningIds?.has(c.id) ? 1 : 0),
    0,
  );
  const summary = [
    `${enabledCount} / ${rules.length}${t.ruleCountSuffix}`,
    openingComponents.length > 0
      ? `${enabledOpeningCount} / ${openingComponents.length}${t.openingComponentCountSuffix}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const hasGlobalCss = Boolean(pack.globalCss?.trim());
  const editable =
    currentUserId !== undefined && pack.ownerUserId === currentUserId;
  const studioHref = editable
    ? studioReturnTo
      ? `/packs/${pack.id}/studio?returnTo=${encodeURIComponent(studioReturnTo)}`
      : `/packs/${pack.id}/studio`
    : null;

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated/60">
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex w-full items-center gap-[var(--space-md)] px-[var(--space-md)] py-[var(--space-sm)] text-left transition-colors hover:bg-bg-elevated/80"
        aria-expanded={!collapsed}
      >
        <span className="flex-1 truncate text-sm font-semibold text-text-primary">
          {pack.name}
        </span>
        {isOfficial && (
          <span className="rounded-[var(--radius-pill)] bg-accent-secondary/10 px-[var(--space-sm)] py-[1px] text-xs text-accent-secondary">
            {t.officialBadge}
          </span>
        )}
        {pack.isPublic && !isOfficial && (
          <span className="rounded-[var(--radius-pill)] bg-accent-primary/10 px-[var(--space-sm)] py-[1px] text-xs text-accent-primary">
            {t.publicBadge}
          </span>
        )}
        <span className="shrink-0 text-xs text-text-muted">{summary}</span>
        <span aria-hidden className="shrink-0 text-xs text-text-muted">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-[var(--space-sm)] border-t border-border-subtle bg-bg-base/40 px-[var(--space-md)] py-[var(--space-md)]">
          {pack.description && (
            <p className="text-xs leading-relaxed text-text-muted">
              {pack.description}
            </p>
          )}

          {hasGlobalCss && (
            <SwitchRow
              label={t.globalCssRow}
              checked={cssEnabled}
              disabled={pending || !onCssToggle}
              onCheckedChange={(v) => onCssToggle?.(v)}
            />
          )}

          {rules.length === 0 ? (
            <p className="text-xs text-text-muted">{t.selectorRulesEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-xs)]">
              {rules.map((rule) => (
                <li key={rule.id}>
                  <SwitchRow
                    label={rule.name}
                    checked={selectedRuleIds.has(rule.id)}
                    disabled={pending}
                    onCheckedChange={(v) => onRuleToggle(rule.id, v)}
                  />
                </li>
              ))}
            </ul>
          )}

          {openingComponents.length > 0 && (
            <div className="flex flex-col gap-[var(--space-xs)] border-t border-border-subtle pt-[var(--space-sm)]">
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-text-muted">
                {t.openingComponentRow}
              </p>
              <ul className="flex flex-col gap-[var(--space-xs)]">
                {openingComponents.map((c) => (
                  <li key={c.id} className="flex flex-col">
                    <SwitchRow
                      label={c.name}
                      checked={selectedOpeningIds?.has(c.id) === true}
                      disabled={pending || !onOpeningComponentToggle}
                      onCheckedChange={(v) =>
                        onOpeningComponentToggle?.(c.id, v)
                      }
                    />
                    <OpeningSlotInputs
                      component={c}
                      enabled={selectedOpeningIds?.has(c.id) === true}
                      slotEditingEnabled={slotEditingEnabled}
                      values={openingSlotValues?.[c.id] ?? {}}
                      onChange={onOpeningSlotChange}
                      pending={pending}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {studioHref && (
            <div className="flex justify-end pt-[var(--space-xs)]">
              <Link
                href={studioHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[var(--radius-pill)] border border-accent-primary/40 px-[var(--space-md)] py-[2px] text-xs text-accent-primary transition-colors hover:border-accent-primary hover:bg-accent-primary/10"
              >
                {t.openStudio}
              </Link>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SwitchRow({
  label,
  sublabel,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const reactId = useId();
  return (
    <div
      className={`flex items-start justify-between gap-[var(--space-md)] py-[var(--space-xs)] ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <label
        htmlFor={reactId}
        className={`min-w-0 flex-1 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`block truncate text-sm ${
            checked ? "text-text-primary" : "text-text-secondary"
          }`}
        >
          {label}
        </span>
        {sublabel && (
          <span className="mt-[2px] block truncate text-xs text-text-muted">
            {sublabel}
          </span>
        )}
      </label>
      <Switch.Root
        id={reactId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className={switchRootCls}
      >
        <Switch.Thumb className={switchThumbCls} />
      </Switch.Root>
    </div>
  );
}

/**
 * Per-character slot fill-ins for one opening component. Slots are the
 * {{custom}} tokens the creator wrote (char/user excluded). Only shown when the
 * component is enabled and the component actually has slots. In create mode
 * (slotEditingEnabled=false) shows a hint to save the character first.
 *
 * Local state mirrors the inputs so typing is responsive; persistence happens
 * on blur via onChange (the parent debounces nothing — one write per blur).
 */
function OpeningSlotInputs({
  component,
  enabled,
  slotEditingEnabled,
  values,
  onChange,
  pending,
}: {
  component: OpeningComponent;
  enabled: boolean;
  slotEditingEnabled: boolean;
  values: Record<string, string>;
  onChange?: (componentId: string, slotKey: string, value: string) => void;
  pending: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.packs;
  const slots = useMemo(
    () => extractOpeningSlots(component.content),
    [component.content],
  );
  const [local, setLocal] = useState<Record<string, string>>(values);

  if (!enabled || slots.length === 0) return null;

  if (!slotEditingEnabled) {
    return (
      <p className="mb-[var(--space-xs)] ml-[var(--space-md)] text-xs text-text-muted">
        {t.openingSlotEmptyHint}
      </p>
    );
  }

  return (
    <div className="mb-[var(--space-xs)] ml-[var(--space-md)] flex flex-col gap-[var(--space-xs)] border-l border-border-subtle pl-[var(--space-md)]">
      <p className="text-xs text-text-muted">{t.openingSlotSectionLabel}</p>
      {slots.map((slot) => (
        <label key={slot} className="flex flex-col gap-[2px]">
          <span className="text-xs text-text-secondary">{slot}</span>
          <textarea
            rows={2}
            value={local[slot] ?? ""}
            disabled={pending}
            placeholder={t.openingSlotPlaceholder}
            onChange={(e) =>
              setLocal((prev) => ({ ...prev, [slot]: e.target.value }))
            }
            onBlur={(e) => {
              const next = e.target.value;
              if (next !== (values[slot] ?? "")) {
                onChange?.(component.id, slot, next);
              }
            }}
            className="w-full resize-y rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-sm)] py-[4px] text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
        </label>
      ))}
    </div>
  );
}
