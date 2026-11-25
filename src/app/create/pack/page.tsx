"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageAtmosphere } from "@/components/PageAtmosphere";
import { useI18n } from "@/i18n/client";
import { createPackAction } from "@/lib/packs/actions";

export default function NewPackPage() {
  const router = useRouter();
  const { dict } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "w-full rounded-[var(--radius-sm)] border border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none";
  const labelCls =
    "mb-[var(--space-xs)] block text-sm font-medium text-text-secondary";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    try {
      const result = await createPackAction({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (result.ok) {
        router.push(`/packs/${result.data.id}/studio`);
      } else {
        setError(dict.packs.newPackFailed);
        setPending(false);
      }
    } catch {
      setError(dict.packs.newPackFailed);
      setPending(false);
    }
  }

  return (
    <PageAtmosphere>
      <div className="mx-auto w-full max-w-xl px-[var(--page-px)] py-[var(--page-py)]">
        <header className="mb-[var(--space-xl)]">
          <h1 className="hero-title">{dict.packs.newPackHero}</h1>
        </header>

        <form
          onSubmit={handleSubmit}
          className="glass-card flex flex-col gap-[var(--space-lg)] p-[var(--space-lg)]"
        >
          <div>
            <label className={labelCls} htmlFor="name">
              {dict.packs.newPackNameLabel}
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={128}
              placeholder={dict.packs.newPackNamePlaceholder}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="description">
              {dict.packs.newPackDescLabel}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={dict.packs.newPackDescPlaceholder}
              className={`${inputCls} font-body-zh leading-relaxed`}
            />
          </div>
          {error && <p className="text-sm text-semantic-error">{error}</p>}
          <div className="flex justify-end gap-[var(--space-md)]">
            <a
              href="/packs"
              className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
            >
              {dict.packs.newPackCancel}
            </a>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-xl)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
            >
              {pending
                ? dict.packs.newPackSubmitting
                : dict.packs.newPackSubmit}
            </button>
          </div>
        </form>
      </div>
    </PageAtmosphere>
  );
}
