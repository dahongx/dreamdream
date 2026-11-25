"use client";

import { useActionState, useEffect, useState } from "react";
import { UserAvatarUpload } from "@/components/settings/UserAvatarUpload";
import { btnPrimary } from "@/components/ui/button";
import { fieldCls } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import {
  type ProfileActionResult,
  updateProfileAction,
} from "@/lib/settings/actions";

interface Props {
  initialDisplayName: string;
  initialUsername: string;
  initialBio: string;
  initialEmail: string;
  initialPhone: string;
  initialAvatarUrl: string;
  fallbackChar: string;
}

const labelCls = "block text-sm text-text-secondary mb-[var(--space-xs)]";
const inputCls = fieldCls;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-semantic-error">{messages.join("，")}</p>;
}

/**
 * Settings form — minimal v1 surface.
 *
 * displayName feeds the `{{user}}` template variable in system prompts,
 * so editing it actually changes how AI chars address the user across
 * every session.
 *
 * username is the @-handle; uniqueness enforced by the DB index.
 *
 * email is shown read-only; changing it would require re-verification
 * which is outside v1 scope (SMTP not fully wired).
 */
export function SettingsForm({
  initialDisplayName,
  initialUsername,
  initialBio,
  initialEmail,
  initialPhone,
  initialAvatarUrl,
  fallbackChar,
}: Props) {
  const { dict } = useI18n();
  const t = dict.settings;
  const [state, formAction, isPending] = useActionState<
    ProfileActionResult | null,
    FormData
  >(updateProfileAction, null);
  const errs = state && !state.ok ? state.fieldErrors : undefined;
  const formErr = state && !state.ok ? state.error : null;

  // Success flash auto-clears after 3s. useActionState's state object
  // identity changes on every action call, so depending on `state` is
  // enough — consecutive successful saves restart the timer cleanly.
  const [showFlash, setShowFlash] = useState(false);
  useEffect(() => {
    if (state?.ok !== true) return;
    setShowFlash(true);
    const id = setTimeout(() => setShowFlash(false), 3000);
    return () => clearTimeout(id);
  }, [state]);

  return (
    <form
      action={formAction}
      className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-xl)]"
    >
      <UserAvatarUpload
        initialValue={initialAvatarUrl}
        fallbackChar={fallbackChar}
      />

      <div>
        <span className={labelCls}>{t.emailLabel}</span>
        <p className="font-mono text-sm text-text-muted">{initialEmail}</p>
      </div>

      <div>
        <label className={labelCls} htmlFor="phone">
          {t.phoneLabel}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          maxLength={32}
          defaultValue={initialPhone}
          placeholder={t.phonePlaceholder}
          className={inputCls}
        />
        <p className="mt-[var(--space-xs)] text-xs text-text-muted">
          {t.phoneHint}
        </p>
        <FieldError messages={errs?.phone} />
      </div>

      <div>
        <label className={labelCls} htmlFor="displayName">
          {t.displayNameLabel}
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={128}
          defaultValue={initialDisplayName}
          className={inputCls}
        />
        <FieldError messages={errs?.displayName} />
      </div>

      <div>
        <label className={labelCls} htmlFor="username">
          {t.usernameLabel}
        </label>
        <input
          id="username"
          name="username"
          minLength={2}
          maxLength={32}
          pattern="[\p{L}\p{M}\p{N}_-]{2,32}"
          defaultValue={initialUsername}
          className={inputCls}
        />
        <FieldError messages={errs?.username} />
      </div>

      <div>
        <label className={labelCls} htmlFor="bio">
          {t.bioLabel}
        </label>
        <textarea
          id="bio"
          name="bio"
          maxLength={280}
          rows={3}
          defaultValue={initialBio}
          placeholder={t.bioPlaceholder}
          className={`${inputCls} resize-y leading-relaxed`}
        />
        <p className="mt-[var(--space-xs)] text-xs text-text-muted">
          {t.bioHint}
        </p>
        <FieldError messages={errs?.bio} />
      </div>

      {formErr && <p className="text-sm text-semantic-error">{formErr}</p>}
      {showFlash && (
        <p className="text-sm text-semantic-success">{t.savedFlash}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={`self-end ${btnPrimary}`}
      >
        {isPending ? t.saving : t.save}
      </button>
    </form>
  );
}
