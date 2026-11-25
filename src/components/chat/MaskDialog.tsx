"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import {
  clearDefaultMaskAction,
  deleteMaskAction,
  saveMaskAction,
  setDefaultMaskAction,
  setSessionActiveMaskAction,
  unsetDefaultMaskAction,
} from "@/lib/masks/actions";
import { canCreateMask } from "@/lib/masks/limits";
import type { MaskListItem } from "@/lib/masks/queries";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  sessionId: string;
  masks: MaskListItem[];
  activeMaskId: string | null;
  onMasksChange: (next: MaskListItem[]) => void;
  onActiveMaskIdChange: (next: string | null) => void;
  hasUnlimitedMasks: boolean;
}

type MaskDraft = {
  id: string | null;
  note: string;
  name: string;
  gender: string;
  description: string;
  preference: string;
  instruction: string;
};

const emptyDraft = (): MaskDraft => ({
  id: null,
  note: "",
  name: "",
  gender: "",
  description: "",
  preference: "",
  instruction: "",
});

function toDraft(mask: MaskListItem): MaskDraft {
  return {
    id: mask.id,
    note: mask.note ?? "",
    name: mask.name,
    gender: mask.gender ?? "",
    description: mask.description ?? "",
    preference: mask.preference ?? "",
    instruction: mask.instruction ?? "",
  };
}

/**
 * Per-session player mask editor. Masks are private user-authored prompt
 * inputs; only the selected mask for this chat session is folded into the next
 * /api/chat system prompt.
 */
export function MaskDialog({
  open,
  onOpenChange,
  sessionId,
  masks,
  activeMaskId,
  onMasksChange,
  onActiveMaskIdChange,
  hasUnlimitedMasks,
}: Props) {
  const { dict } = useI18n();
  const t = dict.chat;
  const { confirm } = useDialog();
  const [draft, setDraft] = useState<MaskDraft>(() => emptyDraft());
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(activeMaskId);
  const wasOpen = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 本地 busy 标志，只跟随 action promise 本身。不能用 useTransition 的
  // isPending —— server action 内的 revalidatePath("/chat") 会让 transition 一直
  // pending 到整个 /chat RSC 段重拉完成,移动网络下经常挂住,表现为「保存中...」卡死。
  const [busy, setBusy] = useState(false);
  const operationPending = useRef(false);
  const initializedSession = useRef<string | null>(null);
  const draftCache = useRef(new Map<string | null, MaskDraft>());

  const activeMask = useMemo(
    () => masks.find((m) => m.id === activeMaskId) ?? null,
    [masks, activeMaskId],
  );
  const storedMask = masks.find((mask) => mask.id === draft.id);
  const canAddMask = canCreateMask(hasUnlimitedMasks, masks.length);
  const hasChanges =
    !storedMask ||
    JSON.stringify(toDraft(storedMask)) !== JSON.stringify(draft);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setEditing(false);
      setSelectedId(activeMaskId);
      setError(null);
      setNotice(null);
    }
    wasOpen.current = open;
  }, [open, activeMaskId]);

  function backToList() {
    if (operationPending.current) return;
    draftCache.current.set(draft.id, draft);
    setEditing(false);
    setError(null);
    setNotice(null);
  }

  useEffect(() => {
    // Closing the dialog is not a request to discard work. Also do not reset
    // a draft when default-star updates replace objects in the mask list.
    if (!open || initializedSession.current === sessionId) return;
    initializedSession.current = sessionId;
    draftCache.current.clear();
    setError(null);
    setNotice(null);
    setDraft(activeMask ? toDraft(activeMask) : emptyDraft());
    setEditing(false);
    setSelectedId(activeMaskId);
  }, [open, activeMask, activeMaskId, sessionId]);

  function update<K extends keyof MaskDraft>(key: K, value: MaskDraft[K]) {
    setNotice(null);
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function editMask(mask: MaskListItem | null) {
    if (operationPending.current) return;
    if (!mask && !canAddMask) return;
    draftCache.current.set(draft.id, draft);
    setError(null);
    setNotice(null);
    setEditing(true);
    setDraft(
      draftCache.current.get(mask?.id ?? null) ??
        (mask ? toDraft(mask) : emptyDraft()),
    );
  }

  async function selectMask(maskId: string | null) {
    if (operationPending.current) return;
    operationPending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await setSessionActiveMaskAction(sessionId, maskId);
      if (!res.ok) {
        setError(t.maskOperationFailed);
        return;
      }
      onActiveMaskIdChange(res.activeMaskId);
      // Activation is explicit and independent of browsing/editing a mask.
      draftCache.current.set(draft.id, draft);
      if (res.activeMaskId === null) setEditing(false);
      setSelectedId(res.activeMaskId);
      onOpenChange(false);
    } catch {
      setError(t.maskOperationFailed);
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (operationPending.current || !draft.name.trim() || !hasChanges) return;
    if (!draft.id && !canAddMask) {
      setError(t.maskQuotaHint.replace("{count}", String(masks.length)));
      return;
    }
    operationPending.current = true;
    setError(null);
    setBusy(true);
    try {
      const res = await saveMaskAction(draft);
      if (!res.ok) {
        setError(
          res.code === "MASK_LIMIT"
            ? t.maskQuotaHint.replace("{count}", String(masks.length))
            : t.maskSaveFailed,
        );
        return;
      }
      onMasksChange([res.mask, ...masks.filter((m) => m.id !== res.mask.id)]);
      draftCache.current.delete(draft.id);
      setDraft(toDraft(res.mask));
      setSelectedId(res.mask.id);
      setEditing(false);
      setNotice(t.maskSaved);
    } catch {
      setError(t.maskSaveFailed);
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  async function toggleDefault(maskId: string | null, currentDefault: boolean) {
    if (operationPending.current) return;
    if (maskId === null && currentDefault) return;
    operationPending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res =
        maskId === null
          ? await clearDefaultMaskAction()
          : currentDefault
            ? await unsetDefaultMaskAction(maskId)
            : await setDefaultMaskAction(maskId);
      if (!res.ok) {
        setError(t.maskOperationFailed);
        return;
      }
      // 更新本地列表:清掉所有面具的 isDefault,再设置目标面具
      const next = masks.map((m) => ({
        ...m,
        isDefault: m.id === maskId ? !currentDefault : false,
      }));
      onMasksChange(next);
      setNotice(null);
    } catch {
      setError(t.maskOperationFailed);
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (operationPending.current) return;
    if (!draft.id) {
      draftCache.current.delete(null);
      setDraft(emptyDraft());
      return;
    }
    const maskId = draft.id;
    operationPending.current = true;
    setBusy(true);
    try {
      const ok = await confirm({ body: t.maskDeleteConfirm, danger: true });
      if (!ok) return;
      setError(null);
      setNotice(null);
      const res = await deleteMaskAction(maskId);
      if (!res.ok) {
        setError(t.maskOperationFailed);
        return;
      }
      const next = masks.filter((m) => m.id !== maskId);
      draftCache.current.delete(maskId);
      onMasksChange(next);
      if (activeMaskId === maskId) onActiveMaskIdChange(null);
      setDraft(emptyDraft());
      if (selectedId === maskId) setSelectedId(null);
      setEditing(false);
    } catch {
      setError(t.maskOperationFailed);
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  const iconButton =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary transition-colors hover:bg-surface-solid hover:text-text-primary disabled:opacity-40";
  const primaryButton =
    "min-h-11 rounded-[var(--radius-md)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-bg-base/85 backdrop-blur-md" />
        <Dialog.Content
          id="nj_mask_dialog"
          className="fixed left-1/2 top-1/2 z-[101] flex max-h-[90dvh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[var(--radius-lg)] border border-border-strong bg-bg-elevated p-[var(--space-lg)] focus:outline-none [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-accent-primary"
        >
          <header className="flex shrink-0 items-center gap-[var(--space-sm)]">
            {editing && (
              <button
                type="button"
                onClick={backToList}
                disabled={busy}
                aria-label={t.maskBack}
                className={iconButton}
              >
                <ArrowLeft size={20} strokeWidth={1.5} />
              </button>
            )}
            <Dialog.Title className="min-w-0 flex-1 truncate font-display-zh text-xl text-text-primary">
              {editing
                ? draft.id
                  ? t.maskEdit
                  : t.maskNew
                : t.maskDialogTitle}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {t.maskDialogHint}
            </Dialog.Description>
            {!editing && (
              <button
                type="button"
                onClick={() => editMask(null)}
                disabled={busy || !canAddMask}
                aria-label={t.maskNew}
                title={
                  !hasUnlimitedMasks
                    ? t.maskQuotaHint.replace("{count}", String(masks.length))
                    : t.maskNew
                }
                className={iconButton}
              >
                <Plus size={20} strokeWidth={1.5} />
              </button>
            )}
            <Dialog.Close aria-label={t.maskClose} className={iconButton}>
              <X size={20} strokeWidth={1.5} />
            </Dialog.Close>
          </header>
          {error && (
            <p
              role="alert"
              className="mt-[var(--space-sm)] text-sm text-semantic-error"
            >
              {error}
            </p>
          )}
          {notice && <output className="sr-only">{notice}</output>}
          {!editing ? (
            <>
              <div className="mt-[var(--space-lg)] flex min-h-0 flex-col gap-[var(--space-sm)] overflow-y-auto">
                {[null, ...masks].map((mask) => {
                  const id = mask?.id ?? null;
                  const name = mask?.name ?? t.maskNoActive;
                  const isDefault = mask
                    ? mask.isDefault
                    : !masks.some((item) => item.isDefault);
                  return (
                    <div
                      key={id ?? "no-mask"}
                      className={`nj_mask_list_item flex shrink-0 items-center rounded-[var(--radius-md)] border pr-[var(--space-xs)] transition-colors ${selectedId === id ? "border-accent-primary bg-accent-primary/10" : "border-border-subtle hover:border-border-strong"}`}
                    >
                      <button
                        type="button"
                        disabled={busy}
                        aria-pressed={selectedId === id}
                        onClick={() => {
                          setSelectedId(id);
                          setError(null);
                          setNotice(null);
                        }}
                        className="flex min-h-[72px] min-w-0 flex-1 flex-col justify-center gap-[var(--space-xs)] px-[var(--space-md)] py-[var(--space-sm)] text-left"
                      >
                        <span className="block w-full truncate text-base text-text-primary">
                          {name}
                        </span>
                        {activeMaskId === id && (
                          <span className="text-xs text-text-secondary">
                            {t.maskInUse}
                          </span>
                        )}
                      </button>
                      {mask && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => editMask(mask)}
                          aria-label={`${t.maskEdit}：${name}`}
                          title={t.maskEdit}
                          className={iconButton}
                        >
                          <Pencil size={17} strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        aria-pressed={isDefault}
                        onClick={() => void toggleDefault(id, isDefault)}
                        aria-label={`${name}：${mask && isDefault ? t.maskUnsetDefault : t.maskSetDefault}`}
                        title={
                          mask && isDefault
                            ? t.maskUnsetDefault
                            : t.maskSetDefault
                        }
                        className={iconButton}
                      >
                        <Star
                          size={18}
                          strokeWidth={1.5}
                          className={
                            isDefault
                              ? "fill-accent-gold text-accent-gold"
                              : "fill-none"
                          }
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
              <footer className="mt-[var(--space-lg)] shrink-0">
                <button
                  type="button"
                  disabled={busy || selectedId === activeMaskId}
                  onClick={() => void selectMask(selectedId)}
                  className={`${primaryButton} w-full`}
                >
                  {t.maskConfirmSelection}
                </button>
              </footer>
            </>
          ) : (
            <form
              className="mt-[var(--space-lg)] flex min-h-0 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                void saveDraft();
              }}
            >
              <fieldset
                disabled={busy}
                className="grid min-h-0 gap-[var(--space-md)] overflow-y-auto pr-[var(--space-xs)]"
              >
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-[var(--space-md)]">
                  <MaskField
                    label={t.maskNameLabel}
                    value={draft.name}
                    maxLength={128}
                    placeholder={t.maskNamePlaceholder}
                    onChange={(v) => update("name", v)}
                    required
                    singleLine
                  />
                  <MaskField
                    label={t.maskGenderLabel}
                    value={draft.gender}
                    maxLength={10}
                    placeholder={t.maskGenderPlaceholder}
                    onChange={(v) => update("gender", v)}
                    singleLine
                  />
                </div>
                <MaskField
                  label={t.maskDescriptionLabel}
                  value={draft.description}
                  maxLength={2000}
                  placeholder={t.maskDescriptionPlaceholder}
                  onChange={(v) => update("description", v)}
                  tall
                />
                <details className="border-t border-border-subtle pt-[var(--space-sm)]">
                  <summary className="cursor-pointer py-[var(--space-sm)] text-sm text-text-secondary focus-visible:outline-accent-primary">
                    {t.maskMore}
                  </summary>
                  <div className="mt-[var(--space-sm)] grid gap-[var(--space-md)]">
                    <MaskField
                      label={t.maskPreferenceLabel}
                      value={draft.preference}
                      maxLength={200}
                      placeholder={t.maskPreferencePlaceholder}
                      onChange={(v) => update("preference", v)}
                    />
                    <MaskField
                      label={t.maskInstructionLabel}
                      value={draft.instruction}
                      maxLength={4000}
                      placeholder={t.maskInstructionPlaceholder}
                      onChange={(v) => update("instruction", v)}
                      tall
                    />
                    <MaskField
                      label={t.maskNoteLabel}
                      value={draft.note}
                      maxLength={2000}
                      placeholder={t.maskNotePlaceholder}
                      onChange={(v) => update("note", v)}
                    />
                    {draft.id && (
                      <button
                        type="button"
                        onClick={() => void deleteDraft()}
                        disabled={busy}
                        className="flex min-h-11 items-center justify-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] text-sm text-semantic-error hover:bg-semantic-error/10"
                      >
                        <Trash2 size={16} />
                        {t.maskDelete}
                      </button>
                    )}
                  </div>
                </details>
              </fieldset>
              <footer className="mt-[var(--space-lg)] shrink-0">
                <button
                  type="submit"
                  disabled={
                    busy ||
                    !draft.name.trim() ||
                    !hasChanges ||
                    (!draft.id && !canAddMask)
                  }
                  title={t.maskSharedHint}
                  className={`${primaryButton} w-full`}
                >
                  {busy ? t.maskSaving : t.maskSave}
                </button>
              </footer>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface MaskFieldProps {
  label: string;
  value: string;
  maxLength: number;
  placeholder: string;
  onChange: (next: string) => void;
  required?: boolean;
  singleLine?: boolean;
  tall?: boolean;
}

function MaskField({
  label,
  value,
  maxLength,
  placeholder,
  onChange,
  required = false,
  singleLine = false,
  tall = false,
}: MaskFieldProps) {
  const fieldId = useId();
  const baseClass =
    "nj_mask_form_field rounded-[var(--radius-sm)] border border-border-subtle bg-bg-base/60 px-[var(--space-md)] py-[var(--space-sm)] font-body-zh text-base leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-disabled focus:border-accent-primary";

  return (
    <label htmlFor={fieldId} className="flex flex-col gap-[var(--space-xs)]">
      <span className="flex items-center justify-between gap-[var(--space-sm)]">
        <span className="font-body-zh text-sm text-text-secondary">
          {label}
        </span>
        <span className="font-mono text-xs text-text-muted">
          {value.length}/{maxLength}
        </span>
      </span>
      {singleLine ? (
        <input
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          required={required}
          className={baseClass}
        />
      ) : (
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          required={required}
          rows={tall ? 4 : 2}
          className={`${baseClass} ${tall ? "min-h-28" : "min-h-16"} resize-y`}
        />
      )}
    </label>
  );
}
