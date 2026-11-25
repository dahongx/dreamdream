"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { importExternalCharacterAction } from "@/lib/characters/import-actions";

/**
 * 「导入外部角色卡」按钮 —— 选一个外部角色卡 XML 导出文件，解析后新建一个
 * 私有角色（含内嵌美化），成功后跳到该角色的编辑页让作者核对补全。
 */
export function ImportExternalCardButton() {
  const router = useRouter();
  const { dict } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 导入成功但有加密字段时：先展示提示，让作者知道哪些要手动搬，再手动进编辑页
  const [locked, setLocked] = useState<{ id: string; fields: string[] } | null>(
    null,
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重选同一文件
    if (!file) return;
    setPending(true);
    setError(null);
    setLocked(null);
    try {
      const text = await file.text();
      const result = await importExternalCharacterAction({
        xmlText: text,
        filename: file.name,
      });
      if (result.ok) {
        if (result.data.lockedFields.length > 0) {
          setLocked({
            id: result.data.characterId,
            fields: result.data.lockedFields,
          });
          setPending(false);
        } else {
          router.push(`/characters/${result.data.characterId}/edit`);
        }
      } else {
        setError(dict.library.importExternalFailed);
        setPending(false);
      }
    } catch {
      setError(dict.library.importExternalFailed);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-[var(--space-xs)]">
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded-[var(--radius-pill)] border border-border-strong px-[var(--space-md)] py-[var(--space-xs)] text-base font-semibold text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary disabled:opacity-60 md:rounded-[var(--radius-sm)]"
      >
        {pending
          ? dict.library.importExternalPending
          : dict.library.importExternalCta}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={handleFile}
      />
      {error && (
        <p className="max-w-[240px] text-right text-[10px] text-rose-400">
          {error}
        </p>
      )}
      {locked && (
        <div className="flex max-w-[280px] flex-col items-end gap-[var(--space-xs)] text-right">
          <p className="text-[10px] leading-relaxed text-accent-gold-soft">
            {dict.library.importExternalLockedPrefix}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/characters/${locked.id}/edit`)}
            className="rounded-[var(--radius-sm)] border border-accent-primary px-[var(--space-sm)] py-[2px] text-[10px] text-accent-primary transition-colors hover:bg-accent-primary/10"
          >
            {dict.library.importExternalContinue}
          </button>
        </div>
      )}
    </div>
  );
}
