"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { Locale } from "./config";
import type { Dict } from "./types";

interface I18nState {
  locale: Locale;
  dict: Dict;
}

const I18nContext = createContext<I18nState | null>(null);

interface Props {
  locale: Locale;
  dict: Dict;
  children: ReactNode;
}

export function I18nProvider({ locale, dict, children }: Props) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useOptionalI18n(): I18nState | null {
  return useContext(I18nContext);
}

export function useI18n(): I18nState {
  const state = useOptionalI18n();
  if (!state) throw new Error("useI18n must be used inside I18nProvider");
  return state;
}
