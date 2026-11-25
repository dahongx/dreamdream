"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import {
  CHARACTER_TAG_OPTIONS,
  type CharacterTag,
  localizeCharacterTagOptions,
} from "@/lib/characters/tags";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

/** 跟 normalizeCharacterTags 对齐:单标签限长、总量上限。 */
const MAX_TAG_LENGTH = 20;
const MAX_TAGS = 20;

export function TagSelector({ value, onChange }: Props) {
  const { dict } = useI18n();
  const [draft, setDraft] = useState("");
  // 「自定义」chip 默认收起;点击才展开下面的输入框(让标签区默认更干净)
  const [showCustomInput, setShowCustomInput] = useState(false);
  const active = new Set(value);
  const tagOptions = localizeCharacterTagOptions(dict.characterTagLabels);
  // 不在固定库里的标签(手动添加 / 从外部迁移过来的自定义标签),单独展示让用户可见/可删
  const customTags = value.filter(
    (t) => !(CHARACTER_TAG_OPTIONS as readonly string[]).includes(t),
  );

  function toggle(tag: CharacterTag) {
    const next = active.has(tag)
      ? value.filter((item) => item !== tag)
      : [...value, tag];
    onChange(next);
  }

  function removeCustom(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  /** 添加手动输入的自定义标签:去空白、限长、去重、限量(跟后端 normalize 同规则)。 */
  function addCustom() {
    const tag = draft.trim().slice(0, MAX_TAG_LENGTH);
    setDraft("");
    if (!tag || active.has(tag) || value.length >= MAX_TAGS) return;
    onChange([...value, tag]);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-[var(--space-md)]">
        <p className="font-display-zh text-base text-text-primary">
          {dict.characterForm.tagsLabel}
        </p>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          {dict.characterForm.tagsClear}
        </button>
      </div>

      <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-xs)]">
        {tagOptions.map(({ value: tag, label }) => {
          const selected = active.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              aria-pressed={selected}
              className={`rounded-[var(--radius-pill)] border px-[var(--space-md)] py-[2px] text-xs transition-colors ${
                selected
                  ? "border-accent-primary bg-accent-primary/15 text-accent-primary"
                  : "border-border-subtle bg-surface-glass text-text-muted hover:border-border-strong hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          );
        })}
        {/* 「自定义」chip:跟库标签同形,点击展开下面的输入框(默认收起) */}
        <button
          type="button"
          onClick={() => setShowCustomInput((v) => !v)}
          aria-expanded={showCustomInput}
          className={`rounded-[var(--radius-pill)] border px-[var(--space-md)] py-[2px] text-xs transition-colors ${
            showCustomInput
              ? "border-accent-secondary bg-accent-secondary/15 text-accent-secondary"
              : "border-accent-secondary/45 bg-accent-secondary/5 text-accent-secondary/80 hover:border-accent-secondary hover:text-accent-secondary"
          }`}
        >
          + {dict.characterForm.tagsCustomLabel}
        </button>
      </div>

      {/* 手动添加自定义标签:点「自定义」chip 才展开。回车或点「添加」。 */}
      {showCustomInput && (
        <div className="mt-[var(--space-sm)] flex gap-[var(--space-xs)]">
          <input
            type="text"
            value={draft}
            maxLength={MAX_TAG_LENGTH}
            placeholder={dict.characterForm.tagsAddPlaceholder}
            // biome-ignore lint/a11y/noAutofocus: 点击展开后自动聚焦输入框,符合用户预期
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            className="min-w-0 flex-1 rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass px-[var(--space-md)] py-[var(--space-xs)] text-xs text-text-primary outline-none focus:border-border-strong"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!draft.trim() || value.length >= MAX_TAGS}
            className="shrink-0 rounded-[var(--radius-pill)] border border-accent-secondary/45 bg-accent-secondary/10 px-[var(--space-md)] py-[var(--space-xs)] text-xs text-accent-secondary transition-colors hover:bg-accent-secondary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dict.characterForm.tagsAddButton}
          </button>
        </div>
      )}

      {customTags.length > 0 && (
        <div className="mt-[var(--space-sm)]">
          <div className="flex flex-wrap gap-[var(--space-xs)]">
            {customTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeCustom(tag)}
                className="rounded-[var(--radius-pill)] border border-accent-gold/40 bg-accent-gold/10 px-[var(--space-md)] py-[2px] text-xs text-accent-gold-soft transition-colors hover:border-rose-400 hover:text-rose-400"
                title={dict.characterForm.tagRemoveHint}
              >
                {tag} ×
              </button>
            ))}
          </div>
        </div>
      )}

      {value.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}
    </div>
  );
}
