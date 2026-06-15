"use client";

import { createContext, useContext } from "react";

import type { Dict } from "./dictionaries";
import type { Locale } from "./types";

/**
 * Carries the server-resolved locale + dictionary to client components. Mounted
 * once in the (app) layout. The dict is a plain serializable object, so passing
 * it as a prop is cheap and avoids per-string round-trips.
 */
const I18nContext = createContext<{ locale: Locale; dict: Dict } | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

/** The translation dictionary in a client component. */
export function useT(): Dict {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useT must be used within <I18nProvider>");
  return v.dict;
}

/** The active locale in a client component (for date formatting). */
export function useLocale(): Locale {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useLocale must be used within <I18nProvider>");
  return v.locale;
}
