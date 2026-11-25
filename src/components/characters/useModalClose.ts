"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Returns a close fn for an intercepted-route modal.
 *
 * Prefers `router.back()` so the modal slot unmounts cleanly via the
 * intercept. Falls back to `router.push(fallbackHref)` for a directly-
 * opened URL (no history to pop).
 */
export function useModalClose(fallbackHref: string) {
  const router = useRouter();
  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [router, fallbackHref]);
}
