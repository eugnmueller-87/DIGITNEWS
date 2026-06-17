"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n/provider";
import { type Locale } from "@/lib/i18n/types";

import { setLanguage } from "./actions";

/**
 * Per-user UI language picker. A simple dropdown that writes the choice via
 * setLanguage (which updates the profile, sets the locale cookie, and
 * revalidates the layout so the whole shell re-renders in the new language).
 */
export function LanguageSelect() {
  const t = useT();
  const current = useLocale();
  const [value, setValue] = useState<Locale>(current);
  const [pending, start] = useTransition();

  function onChange(next: Locale) {
    setValue(next); // optimistic
    start(async () => {
      const res = await setLanguage(next);
      if (!res.ok) setValue(current); // revert on failure
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            {t.settings.languageHeading}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t.settings.languageDesc}
          </p>
        </div>
        <select
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value as Locale)}
          aria-label={t.settings.languageHeading}
          className="h-11 shrink-0 rounded-[12px] border border-border bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-accent disabled:opacity-50"
        >
          <option value="de">{t.settings.languageDe}</option>
          <option value="en">{t.settings.languageEn}</option>
          <option value="ru">{t.settings.languageRu}</option>
        </select>
      </div>
    </Card>
  );
}
