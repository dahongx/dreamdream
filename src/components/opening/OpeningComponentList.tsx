"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import type { OpeningComponent } from "@/lib/db/schema";
import {
  deleteOpeningComponentAction,
  swapOpeningComponentOrderAction,
} from "@/lib/opening/actions";

/**
 * Opening-component list for the pack detail page and studio drawer.
 *
 * Two modes:
 *  - studio: pass onCreate / onEditOverride / onDeleteOverride — create + edit
 *    go through the AI-session flow (StudioLayout.handleCreate), delete is
 *    managed by the studio so it can sync local state.
 *  - pack detail (no callbacks): create / edit link into the studio; delete
 *    runs the server action directly.
 */

interface Props {
  packId: string;
  components: OpeningComponent[];
  readOnly?: boolean;
  onCreate?: () => void;
  onEditOverride?: (componentId: string) => void;
  onDeleteOverride?: (componentId: string) => void;
  onViewSource?: (componentId: string) => void;
}

export function OpeningComponentList({
  packId,
  components,
  readOnly = false,
  onCreate,
  onEditOverride,
  onDeleteOverride,
  onViewSource,
}: Props) {
  const { dict } = useI18n();
  const t = dict.opening;
  const studioHref = `/packs/${packId}/studio`;

  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      {!readOnly && (
        <div className="flex justify-end">
          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
            >
              {t.addButton}
            </button>
          ) : (
            <Link
              href={studioHref}
              className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
            >
              {t.addButton}
            </Link>
          )}
        </div>
      )}
      <div className="glass-card overflow-hidden">
        {components.length === 0 ? (
          <div className="flex flex-col items-center gap-[var(--space-sm)] p-[var(--space-xl)] text-center">
            <p className="font-display-zh text-xl text-text-primary">
              {t.emptyTitle}
            </p>
          </div>
        ) : (
          <table className="w-full table-auto text-left text-sm">
            <thead className="border-b border-border-subtle text-xs uppercase tracking-[0.2em] text-text-muted">
              <tr>
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.listColName}
                </th>
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.listColOrder}
                </th>
                {!readOnly && (
                  <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                    {t.listColActions}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {components.map((c, i) => (
                <Row
                  key={c.id}
                  component={c}
                  studioHref={studioHref}
                  prevId={i > 0 ? components[i - 1].id : null}
                  nextId={
                    i < components.length - 1 ? components[i + 1].id : null
                  }
                  readOnly={readOnly}
                  onEditOverride={onEditOverride}
                  onDeleteOverride={onDeleteOverride}
                  onViewSource={onViewSource}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Row({
  component,
  studioHref,
  prevId,
  nextId,
  readOnly,
  onEditOverride,
  onDeleteOverride,
  onViewSource,
}: {
  component: OpeningComponent;
  studioHref: string;
  prevId: string | null;
  nextId: string | null;
  readOnly: boolean;
  onEditOverride?: (componentId: string) => void;
  onDeleteOverride?: (componentId: string) => void;
  onViewSource?: (componentId: string) => void;
}) {
  const { dict } = useI18n();
  const t = dict.opening;
  const dialog = useDialog();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (onDeleteOverride) {
      onDeleteOverride(component.id);
      return;
    }
    void (async () => {
      if (!(await dialog.confirm({ body: t.confirmDelete, danger: true })))
        return;
      startTransition(async () => {
        await deleteOpeningComponentAction(component.id);
      });
    })();
  }

  function onSwap(otherId: string | null) {
    if (!otherId) return;
    startTransition(async () => {
      await swapOpeningComponentOrderAction(component.id, otherId);
    });
  }

  // 草稿虚拟项（studio 新建会话尚未 commit）不挂操作入口。
  const isDraft = component.id.startsWith("draft-");

  return (
    <tr
      className={`border-b border-border-subtle/40 last:border-none ${pending ? "opacity-50" : ""}`}
    >
      <td className="px-[var(--space-md)] py-[var(--space-sm)] font-display-zh text-text-primary">
        {component.name}
        {!component.enabled && (
          <span className="ml-[var(--space-sm)] rounded-[var(--radius-pill)] bg-surface-glass px-[var(--space-sm)] py-[1px] text-[10px] text-text-muted">
            {t.disabledBadge}
          </span>
        )}
      </td>
      <td className="px-[var(--space-md)] py-[var(--space-sm)] font-mono text-text-muted">
        <div className="flex items-center gap-[var(--space-xs)]">
          {!readOnly && !isDraft && (
            <>
              <button
                type="button"
                onClick={() => onSwap(prevId)}
                disabled={pending || !prevId}
                aria-label={t.moveUpAria}
                className="rounded-[var(--radius-sm)] border border-border-subtle px-[6px] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onSwap(nextId)}
                disabled={pending || !nextId}
                aria-label={t.moveDownAria}
                className="rounded-[var(--radius-sm)] border border-border-subtle px-[6px] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
              >
                ↓
              </button>
            </>
          )}
          <span>{component.orderIndex}</span>
        </div>
      </td>
      {!readOnly && (
        <td className="px-[var(--space-md)] py-[var(--space-sm)]">
          {isDraft ? (
            <span className="text-xs text-text-muted">—</span>
          ) : (
            <div className="flex gap-[var(--space-sm)]">
              {onViewSource && (
                <button
                  type="button"
                  onClick={() => onViewSource(component.id)}
                  className="text-accent-primary hover:underline"
                >
                  {t.actionViewSource}
                </button>
              )}
              {onEditOverride ? (
                <button
                  type="button"
                  onClick={() => onEditOverride(component.id)}
                  className="text-accent-primary hover:underline"
                >
                  {t.actionEdit}
                </button>
              ) : (
                <Link
                  href={studioHref}
                  className="text-accent-primary hover:underline"
                >
                  {t.actionEdit}
                </Link>
              )}
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="text-semantic-error hover:underline"
              >
                {t.actionDelete}
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
