"use client";

import { useEffect, useState } from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { btnPrimaryLg } from "@/components/ui/button";
import { fieldCls } from "@/components/ui/field";
import type { Dict } from "@/i18n/types";
import { AuthQueryMessage } from "../AuthQueryMessage";

const STORAGE_KEY = "dearm_saved_credentials";

function loadSaved(): {
  email: string;
  password: string;
  remember: boolean;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(atob(raw));
    if (parsed?.email && parsed?.password) {
      return { email: parsed.email, password: parsed.password, remember: true };
    }
  } catch {
    /* corrupted — ignore */
  }
  return null;
}

function persistCredentials(email: string, password: string) {
  localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify({ email, password })));
}

function clearCredentials() {
  localStorage.removeItem(STORAGE_KEY);
}

export function SignInForm({
  dict,
  error,
  notice,
  next,
}: {
  dict: Dict;
  error?: string;
  notice?: string;
  next?: string;
}) {
  const t = dict.auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setEmail(saved.email);
      setPassword(saved.password);
      setRemember(true);
    }
    setLoaded(true);
  }, []);

  function handleSubmit() {
    if (remember && email && password) {
      persistCredentials(email, password);
    } else {
      clearCredentials();
    }
    // 原生 form POST 会整页跳转，state 在导航前短暂生效：按钮变呼吸点
    // 并 disabled，防重复提交（之前点击后零反馈、可连点）。
    setSubmitting(true);
  }

  return (
    <form
      action="/api/auth/signin"
      method="post"
      onSubmit={handleSubmit}
      className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]"
    >
      {next && next !== "/" && <input type="hidden" name="next" value={next} />}
      <label className="flex flex-col gap-[var(--space-xs)]">
        <span className="text-sm text-text-secondary">{t.emailLabel}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          className={fieldCls}
        />
      </label>
      <label className="flex flex-col gap-[var(--space-xs)]">
        <span className="text-sm text-text-secondary">{t.passwordLabel}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.passwordPlaceholder}
          className={fieldCls}
        />
      </label>
      <div className="flex items-center justify-between gap-[var(--space-sm)]">
        <label
          className={`flex cursor-pointer select-none items-center gap-[var(--space-sm)] transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => {
              setRemember(e.target.checked);
              if (!e.target.checked) clearCredentials();
            }}
            className="h-4 w-4 accent-accent-primary"
          />
          <span className="text-sm text-text-muted">{t.rememberPassword}</span>
        </label>
        <a
          href="/forgot-password"
          className="text-sm text-text-muted underline-offset-4 hover:text-accent-primary hover:underline"
        >
          {t.forgotPasswordLink}
        </a>
      </div>
      <AuthQueryMessage
        errors={{
          callbackFailed: t.callbackFailed,
          checkEmail: t.checkEmail,
          emailInvalid: t.emailInvalid,
          wrongCredentials: t.wrongCredentials,
        }}
        notices={{
          checkEmail: t.checkEmail,
          confirmed: t.emailConfirmed,
          passwordReset: t.passwordReset,
        }}
        fallbackError={t.wrongCredentials}
        initialError={error}
        initialNotice={notice}
      />
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={btnPrimaryLg}
      >
        {submitting && <BreathingDots onAccent size={6} />}
        {submitting ? t.signingInButton : t.signInButton}
      </button>
    </form>
  );
}
