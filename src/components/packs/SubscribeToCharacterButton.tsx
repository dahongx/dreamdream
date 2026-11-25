"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { subscribePackToCharacterAction } from "@/lib/packs/actions";

interface Props {
  packId: string;
  myCharacters: { id: string; name: string }[];
}

export function SubscribeToCharacterButton({ packId, myCharacters }: Props) {
  const { dict } = useI18n();
  const [selectedId, setSelectedId] = useState(myCharacters[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (myCharacters.length === 0) return null;

  function handleSubscribe() {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const res = await subscribePackToCharacterAction(packId, selectedId);
      if (res.ok) {
        setDone(true);
      } else {
        setError(dict.packs.studioOperationFailed);
      }
    });
  }

  if (done) {
    return (
      <span className="text-sm text-accent-primary">
        {dict.packs.subscribeSuccess}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        disabled={pending}
        className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-primary disabled:opacity-60"
      >
        {myCharacters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={pending || !selectedId}
        className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
      >
        {pending ? dict.packs.subscribeSubmitting : dict.packs.subscribeButton}
      </button>
      {error && <p className="w-full text-xs text-semantic-error">{error}</p>}
    </div>
  );
}
