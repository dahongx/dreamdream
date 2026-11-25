"use client";

import { useEffect, useState } from "react";

interface AuthQueryMessageProps {
  errors?: Record<string, string>;
  notices?: Record<string, string>;
  fallbackError?: string;
  initialError?: string;
  initialNotice?: string;
}

export function AuthQueryMessage({
  errors = {},
  notices = {},
  fallbackError,
  initialError,
  initialNotice,
}: AuthQueryMessageProps) {
  const [query, setQuery] = useState<{ error?: string; message?: string }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery({
      error: params.get("error") ?? undefined,
      message: params.get("message") ?? undefined,
    });
  }, []);

  const notice =
    initialNotice ?? (query.message ? notices[query.message] : undefined);
  const error =
    initialError ??
    (query.error ? (errors[query.error] ?? fallbackError) : undefined);

  return (
    <>
      {notice ? (
        <p className="text-sm text-semantic-success" aria-live="polite">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-semantic-error" aria-live="polite">
          {error}
        </p>
      ) : null}
    </>
  );
}
