"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type {
  OpeningComponent,
  RegexRule,
  StudioDraftPayload,
  StudioSession,
} from "@/lib/db/schema";

interface Props {
  sessions: StudioSession[];
  persistedRules: RegexRule[];
  persistedOpening: OpeningComponent[];
  activeSessionId: string | null;
  onSelect: (sessionId: string | null) => void;
  onNew: () => void;
  onEditRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string, ruleName: string) => void;
  onEditOpening: (componentId: string) => void;
  onDeleteOpening: (componentId: string) => void;
}

export function StudioSessionSidebar({
  sessions,
  persistedRules,
  persistedOpening,
  activeSessionId,
  onSelect,
  onNew,
  onEditRule,
  onDeleteRule,
  onEditOpening,
  onDeleteOpening,
}: Props) {
  const { dict } = useI18n();
  const t = dict.packs;
  const [showDiscarded, setShowDiscarded] = useState(false);

  const grouped = useMemo(() => {
    const active: StudioSession[] = [];
    const committed: StudioSession[] = [];
    const discarded: StudioSession[] = [];
    for (const s of sessions) {
      if (s.status === "active") {
        active.push(s);
      } else if (s.status === "committed") {
        if (
          (s.type === "component" || s.type === "opening") &&
          !resolveTarget(s, persistedRules, persistedOpening)
        )
          continue;
        committed.push(s);
      } else {
        discarded.push(s);
      }
    }
    return { active, committed, discarded };
  }, [sessions, persistedRules, persistedOpening]);

  return (
    <aside
      id="nj_pack_studio_sessions"
      className="flex h-full w-full shrink-0 flex-col border-r border-border-subtle bg-bg-elevated md:w-[240px]"
    >
      <div className="shrink-0 border-b border-border-subtle p-[var(--space-sm)]">
        <button
          type="button"
          onClick={onNew}
          id="nj_pack_studio_session_new"
          className="w-full rounded-[var(--radius-sm)] border border-accent-primary/60 bg-accent-primary/10 px-[var(--space-sm)] py-[2px] text-[11px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary/20"
        >
          {t.studioSessionsNew}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-[var(--space-sm)]">
        {sessions.length === 0 ? (
          <p className="px-[var(--space-sm)] py-[var(--space-md)] text-center text-xs text-text-muted">
            {t.studioSessionsEmpty}
          </p>
        ) : (
          <div className="flex flex-col gap-[var(--space-md)]">
            <SessionGroup
              heading={t.studioSessionsGroupActive}
              sessions={grouped.active}
              persistedRules={persistedRules}
              persistedOpening={persistedOpening}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
              onEditRule={onEditRule}
              onDeleteRule={onDeleteRule}
              onEditOpening={onEditOpening}
              onDeleteOpening={onDeleteOpening}
            />
            <SessionGroup
              heading={t.studioSessionsGroupCommitted}
              sessions={grouped.committed}
              persistedRules={persistedRules}
              persistedOpening={persistedOpening}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
              onEditRule={onEditRule}
              onDeleteRule={onDeleteRule}
              onEditOpening={onEditOpening}
              onDeleteOpening={onDeleteOpening}
              dim
            />
            {grouped.discarded.length > 0 && (
              <div className="flex flex-col gap-[var(--space-xs)]">
                <button
                  type="button"
                  onClick={() => setShowDiscarded((v) => !v)}
                  className="self-start text-xs text-text-muted underline-offset-2 hover:text-text-secondary hover:underline"
                >
                  {showDiscarded
                    ? t.studioSessionsHideDiscarded
                    : t.studioSessionsShowDiscarded.replace(
                        "{n}",
                        String(grouped.discarded.length),
                      )}
                </button>
                {showDiscarded && (
                  <SessionGroup
                    heading={t.studioSessionsGroupDiscarded}
                    sessions={grouped.discarded}
                    persistedRules={persistedRules}
                    persistedOpening={persistedOpening}
                    activeSessionId={activeSessionId}
                    onSelect={onSelect}
                    onEditRule={onEditRule}
                    onDeleteRule={onDeleteRule}
                    onEditOpening={onEditOpening}
                    onDeleteOpening={onDeleteOpening}
                    dim
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

type ResolvedTarget =
  | { kind: "rule"; id: string; name: string }
  | { kind: "opening"; id: string; name: string };

function resolveTarget(
  session: StudioSession,
  persistedRules: RegexRule[],
  persistedOpening: OpeningComponent[],
): ResolvedTarget | null {
  if (session.type === "component") {
    if (session.targetRuleId) {
      const rule = persistedRules.find((r) => r.id === session.targetRuleId);
      return rule ? { kind: "rule", id: rule.id, name: rule.name } : null;
    }
    const payload = session.draftPayload as StudioDraftPayload | null;
    if (payload?.kind === "rule" && payload.rule.name) {
      const matched = persistedRules.find((r) => r.name === payload.rule.name);
      if (matched) return { kind: "rule", id: matched.id, name: matched.name };
    }
    return null;
  }
  if (session.type === "opening") {
    if (session.targetOpeningComponentId) {
      const oc = persistedOpening.find(
        (c) => c.id === session.targetOpeningComponentId,
      );
      return oc ? { kind: "opening", id: oc.id, name: oc.name } : null;
    }
    const payload = session.draftPayload as StudioDraftPayload | null;
    if (payload?.kind === "opening" && payload.opening.name) {
      const matched = persistedOpening.find(
        (c) => c.name === payload.opening.name,
      );
      if (matched)
        return { kind: "opening", id: matched.id, name: matched.name };
    }
    return null;
  }
  return null;
}

function SessionGroup({
  heading,
  sessions,
  persistedRules,
  persistedOpening,
  activeSessionId,
  onSelect,
  onEditRule,
  onDeleteRule,
  onEditOpening,
  onDeleteOpening,
  dim,
}: {
  heading: string;
  sessions: StudioSession[];
  persistedRules: RegexRule[];
  persistedOpening: OpeningComponent[];
  activeSessionId: string | null;
  onSelect: (id: string | null) => void;
  onEditRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string, ruleName: string) => void;
  onEditOpening: (componentId: string) => void;
  onDeleteOpening: (componentId: string) => void;
  dim?: boolean;
}) {
  if (sessions.length === 0) return null;
  return (
    <div className="flex flex-col gap-[var(--space-xs)]">
      <p className="px-[var(--space-xs)] font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
        {heading}
      </p>
      <ul className="flex flex-col gap-[2px]">
        {sessions.map((s) => (
          <li key={s.id}>
            <SessionRow
              session={s}
              resolved={resolveTarget(s, persistedRules, persistedOpening)}
              active={s.id === activeSessionId}
              onSelect={() => onSelect(s.id)}
              onEditRule={onEditRule}
              onDeleteRule={onDeleteRule}
              onEditOpening={onEditOpening}
              onDeleteOpening={onDeleteOpening}
              dim={dim}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionRow({
  session,
  resolved,
  active,
  onSelect,
  onEditRule,
  onDeleteRule,
  onEditOpening,
  onDeleteOpening,
  dim,
}: {
  session: StudioSession;
  resolved: ResolvedTarget | null;
  active: boolean;
  onSelect: () => void;
  onEditRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string, ruleName: string) => void;
  onEditOpening: (componentId: string) => void;
  onDeleteOpening: (componentId: string) => void;
  dim?: boolean;
}) {
  const { dict, locale } = useI18n();
  const t = dict.packs;
  const typeLabel =
    session.type === "css"
      ? t.studioSessionTypeSkin
      : session.type === "opening"
        ? session.targetOpeningComponentId
          ? t.studioSessionTypeOpeningEdit
          : t.studioSessionTypeOpening
        : session.targetRuleId
          ? t.studioSessionTypeBlockEdit
          : t.studioSessionTypeBlock;
  const typeColor =
    session.type === "css"
      ? "border-accent-primary/40 bg-accent-primary/10 text-accent-primary"
      : session.type === "opening"
        ? "border-accent-primary/40 bg-accent-primary/10 text-accent-primary"
        : "border-accent-gold/40 bg-accent-gold/10 text-accent-gold";
  const draftLabel = sessionDraftLabel(session);
  const displayTitle = session.title?.trim()
    ? session.title
    : (draftLabel ?? t.studioSessionUntitled);
  return (
    <div
      className={`nj_pack_studio_session_item group relative flex w-full flex-col gap-[2px] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-left transition-colors ${
        active
          ? "bg-accent-primary/15 text-text-primary"
          : "text-text-secondary hover:bg-surface-glass/40 hover:text-text-primary"
      } ${dim ? "opacity-70 hover:opacity-100" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col gap-[2px] text-left"
      >
        <div className="flex items-center gap-[var(--space-xs)]">
          <span
            className={`shrink-0 rounded-[var(--radius-pill)] border px-[6px] py-[1px] text-[10px] font-semibold uppercase tracking-[0.1em] ${typeColor}`}
          >
            {typeLabel}
          </span>
        </div>
        <span className="truncate text-xs">{displayTitle}</span>
        <span className="font-mono text-[10px] text-text-muted">
          {relativeTime(session.updatedAt, locale)}
        </span>
      </button>
      {resolved && (
        <div className="absolute right-[var(--space-xs)] top-1/2 flex -translate-y-1/2 gap-[2px] opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title={t.studioSessionEditRule}
            onClick={(e) => {
              e.stopPropagation();
              if (resolved.kind === "rule") onEditRule(resolved.id);
              else onEditOpening(resolved.id);
            }}
            className="rounded-[var(--radius-sm)] p-[3px] text-text-muted transition-colors hover:bg-accent-primary/20 hover:text-accent-primary"
          >
            <Pencil width={12} height={12} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            title={t.studioSessionDeleteRule}
            onClick={(e) => {
              e.stopPropagation();
              if (resolved.kind === "rule")
                onDeleteRule(resolved.id, resolved.name);
              else onDeleteOpening(resolved.id);
            }}
            className="rounded-[var(--radius-sm)] p-[3px] text-text-muted transition-colors hover:bg-semantic-error/20 hover:text-semantic-error"
          >
            <Trash2 width={12} height={12} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}

function sessionDraftLabel(session: StudioSession): string | null {
  if (!session.draftPayload || typeof session.draftPayload !== "object") {
    return null;
  }
  const payload = session.draftPayload as {
    kind?: string;
    rule?: { name?: string };
    opening?: { name?: string };
  };
  if (payload.kind === "rule" && payload.rule?.name) {
    return payload.rule.name;
  }
  if (payload.kind === "opening" && payload.opening?.name) {
    return payload.opening.name;
  }
  return null;
}

function relativeTime(d: Date | string, locale: Locale): string {
  const t = typeof d === "string" ? new Date(d) : d;
  const diff = Math.max(0, Date.now() - t.getTime());
  const m = Math.floor(diff / 60_000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (m < 1) return formatter.format(0, "second");
  if (m < 60) return formatter.format(-m, "minute");
  const h = Math.floor(m / 60);
  if (h < 24) return formatter.format(-h, "hour");
  const day = Math.floor(h / 24);
  if (day < 30) return formatter.format(-day, "day");
  return new Intl.DateTimeFormat(locale).format(t);
}
