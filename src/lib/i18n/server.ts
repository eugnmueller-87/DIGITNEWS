import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getSessionProfile } from "@/lib/auth";

import { DICTS, type Dict } from "./dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./types";

/**
 * Resolve the active UI locale on the server: the logged-in user's saved
 * preference first, else the `locale` cookie (covers public/pre-session
 * renders), else the default. cache()-wrapped, and getSessionProfile() is itself
 * cache()'d, so this adds no extra DB round-trip per request.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const session = await getSessionProfile();
  if (session && isLocale(session.language)) return session.language;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
});

/** The translation dictionary for the active locale (server components). */
export const getDict = cache(
  async (): Promise<Dict> => DICTS[await getLocale()],
);
