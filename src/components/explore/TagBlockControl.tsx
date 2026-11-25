"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { EyeOff, X } from "lucide-react";
import { useState } from "react";
import { useExploreTransition } from "@/components/explore/ExploreTransition";

interface Props {
  /** 平台预设常用标签，供弹窗里点选。 */
  presetTags: Array<{ value: string; label: string }>;
  /** 当前已屏蔽标签（来自 URL excludeTag[]，服务端渲染的真相）。 */
  initialBlocked: string[];
  /**
   * 当前正向筛选 tag —— 保存时若它同时被屏蔽则清掉，避免「既要又屏蔽」
   * 自相矛盾（跟 explore/page.tsx 服务端 buildUrl 的语义对齐）。
   */
  activeTag?: string;
  /** 保存时保留的排序（非 hot 才写进 URL，跟服务端 buildUrl 对齐）。 */
  sort?: string;
  /** 保存时保留的搜索词。 */
  search?: string;
  /** 触发按钮文案（「屏蔽标签」）。 */
  triggerLabel: string;
  /** 弹窗标题。 */
  modalTitle: string;
  /** token 输入框 placeholder。 */
  inputPlaceholder: string;
  /** 预设区小标题。 */
  presetHint: string;
  /** 保存按钮文案。 */
  saveLabel: string;
  /** 关闭按钮 aria。 */
  closeLabel: string;
  /** chip × 的 aria 前缀（拼接标签名）。 */
  removeHint: string;
}

/** 单标签长度上限，跟 normalizeCharacterTags 的 MAX_TAG_LENGTH 对齐。 */
const MAX_TAG_LEN = 20;
/** 屏蔽标签数量上限。 */
const MAX_TAGS = 20;

/**
 * 屏蔽标签控件。
 *
 * 入口是一个「屏蔽标签」按钮（有屏蔽项时带数字角标）。点开弹窗：
 *   - token 输入框：已选标签是带 × 的 chip；**手输 + 回车 = 加自定义标签**
 *     （寄情支持自定义标签，不能只从预设里选），退格删最后一个。
 *   - 预设网格：平台常用标签，点一下加入 / 再点移除，已选高亮。
 *   - 「保存」→ 把最终列表拼进 explore 的 excludeTag[] 参数并导航。
 *
 * 屏蔽过滤链路仍是 explore 页现成的 excludeTag[] URL 参数（后端 queries.ts
 * 的 `NOT (tags ?| array[...])` 接受任意字符串，自定义标签一样能屏蔽）。
 * 本组件只负责收集最终列表并导航，不碰过滤 SQL。URL 构造跟服务端 buildUrl
 * 语义一致（sort 非 hot 才带、保留 q、屏蔽项与正向 tag 冲突时清掉 tag）。
 */
export function TagBlockControl({
  presetTags,
  initialBlocked,
  activeTag,
  sort,
  search,
  triggerLabel,
  modalTitle,
  inputPlaceholder,
  presetHint,
  saveLabel,
  closeLabel,
  removeHint,
}: Props) {
  const { navigate } = useExploreTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialBlocked);
  const [draft, setDraft] = useState("");
  const presetLabelByValue = new Map(
    presetTags.map(({ value, label }) => [value, label]),
  );
  const presetValueByLabel = new Map(
    presetTags.map(({ value, label }) => [label, value]),
  );

  function displayTag(value: string): string {
    return presetLabelByValue.get(value) ?? value;
  }

  function buildUrl(blocked: string[]): string {
    const p = new URLSearchParams();
    if (sort && sort !== "recommended") p.set("sort", sort);
    if (search) p.set("q", search);
    // 正向 tag 保留，除非它正被屏蔽（既要又屏蔽 → 以屏蔽为准，清掉正向）。
    if (activeTag && !blocked.includes(activeTag)) p.set("tag", activeTag);
    for (const t of blocked) p.append("excludeTag", t);
    const qs = p.toString();
    return qs ? `/explore?${qs}` : "/explore";
  }

  function addTag(raw: string) {
    const trimmed = raw.trim();
    const t = (presetValueByLabel.get(trimmed) ?? trimmed).slice(
      0,
      MAX_TAG_LEN,
    );
    if (!t) return;
    setSelected((prev) =>
      prev.includes(t) || prev.length >= MAX_TAGS ? prev : [...prev, t],
    );
    setDraft("");
  }

  function removeTag(t: string) {
    setSelected((prev) => prev.filter((x) => x !== t));
  }

  function togglePreset(t: string) {
    setSelected((prev) =>
      prev.includes(t)
        ? prev.filter((x) => x !== t)
        : prev.length >= MAX_TAGS
          ? prev
          : [...prev, t],
    );
  }

  function save() {
    setOpen(false);
    navigate(buildUrl(selected));
  }

  const count = initialBlocked.length;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        // 每次开弹窗都以当前 URL 屏蔽状态为准重置本地选择（同路由不同 query
        // 导航后组件实例不重挂，靠这里同步）。
        if (o) setSelected(initialBlocked);
        setDraft("");
        setOpen(o);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="tag-chip tag-block-trigger inline-flex shrink-0 items-center gap-[var(--space-xs)] rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-md)] py-[4px] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <EyeOff size={16} strokeWidth={1.5} aria-hidden />
          <span>{triggerLabel}</span>
          {count > 0 && (
            <span className="ml-[2px] rounded-[var(--radius-pill)] bg-accent-primary px-[6px] text-xs font-semibold text-text-on-accent">
              {count}
            </span>
          )}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-bg-base/85 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[86dvh] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-[var(--space-md)] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-lg)] shadow-[0_30px_90px_rgba(0,0,0,0.5)] focus:outline-none">
          <div className="flex shrink-0 items-center justify-between">
            <Dialog.Title className="font-display-zh text-xl text-text-primary">
              {modalTitle}
            </Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="rounded-[var(--radius-sm)] p-[var(--space-2xs)] text-text-muted transition-colors hover:text-text-primary"
            >
              <X size={20} strokeWidth={1.5} aria-hidden />
            </Dialog.Close>
          </div>

          {/* token 输入框：已选 chip + 文本输入。input 占 flex-1 铺满整行，
              直接点框内即落在 input 上，无需额外 onClick。 */}
          <div className="flex max-h-[120px] shrink-0 flex-wrap items-center gap-[var(--space-xs)] overflow-y-auto rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass px-[var(--space-sm)] py-[var(--space-xs)] focus-within:border-border-strong">
            {selected.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-[var(--space-2xs)] rounded-[var(--radius-sm)] bg-surface-solid px-[var(--space-xs)] py-[2px] text-sm text-text-primary"
              >
                {displayTag(t)}
                <button
                  type="button"
                  aria-label={`${removeHint} ${displayTag(t)}`}
                  onClick={() => removeTag(t)}
                  className="text-text-muted transition-colors hover:text-semantic-error"
                >
                  <X size={14} strokeWidth={1.5} aria-hidden />
                </button>
              </span>
            ))}
            <input
              type="text"
              autoComplete="off"
              enterKeyHint="done"
              value={draft}
              placeholder={selected.length === 0 ? inputPlaceholder : ""}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(draft);
                } else if (
                  e.key === "Backspace" &&
                  draft === "" &&
                  selected.length > 0
                ) {
                  removeTag(selected[selected.length - 1]);
                }
              }}
              className="min-w-[80px] flex-1 bg-transparent py-[2px] text-base text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          {/* 预设网格：占剩余高度，超出滚动。 */}
          <div className="flex min-h-0 flex-1 flex-col gap-[var(--space-sm)]">
            <span className="shrink-0 text-xs text-text-muted">
              {presetHint}
            </span>
            <div className="flex flex-1 flex-wrap content-start gap-[var(--space-xs)] overflow-y-auto pr-[var(--space-2xs)]">
              {presetTags.map(({ value, label }) => {
                const on = selected.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => togglePreset(value)}
                    className={
                      on
                        ? "h-fit rounded-[var(--radius-pill)] border border-accent-primary bg-accent-primary/15 px-[var(--space-md)] py-[var(--space-2xs)] text-sm text-accent-primary transition-colors"
                        : "h-fit rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-md)] py-[var(--space-2xs)] text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            className="shrink-0 rounded-[var(--radius-pill)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-base font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active"
          >
            {saveLabel}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
