import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getDictionaryForLocale,
  LocaleCode,
  LocaleOption,
  SUPPORTED_LOCALES,
  TranslationKey,
} from './translations';

const LOCALE_STORAGE_KEY = 'shogi_studio_locale_v1';

interface I18nContextValue {
  locale: LocaleCode;
  localeMeta: LocaleOption;
  setLocale: (next: LocaleCode) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveInitialLocale(): LocaleCode {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
      return saved as LocaleCode;
    }
  } catch {
    // ignore storage errors
  }
  return 'id-ID';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [locale, setLocaleState] = useState<LocaleCode>(resolveInitialLocale);

  const setLocale = (next: LocaleCode) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = getDictionaryForLocale(locale);
    const localeMeta =
      SUPPORTED_LOCALES.find((l) => l.code === locale) ?? SUPPORTED_LOCALES[0];
    return {
      locale,
      localeMeta,
      setLocale,
      t: (key) => dict[key] ?? key,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}

export { SUPPORTED_LOCALES };
export type { LocaleCode, LocaleOption, TranslationKey };
