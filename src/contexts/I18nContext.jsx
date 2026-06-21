import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { detectLocale, setLocale, setGlobalLocale, t as _t, SUPPORTED_LOCALES, LOCALE_NAMES } from "../lib/i18n.js";

const I18nCtx = createContext({ t: k => k, locale: "ru", changeLocale: () => {} });

export function I18nProvider({ children, language, onLocaleChange }) {
  const [locale, setLocaleState] = useState(() => {
    const l = detectLocale(language);
    setLocale(l);
    return l;
  });

  // Sync when logged-in user's language preference loads from server
  useEffect(() => {
    if (!language) return;
    const l = detectLocale(language);
    setLocale(l);
    setLocaleState(l);
  }, [language]);

  const changeLocale = useCallback((code) => {
    setGlobalLocale(code);
    setLocale(code);
    setLocaleState(code);
    onLocaleChange?.(code);
  }, [onLocaleChange]);

  const tFn = useCallback((key, vars) => _t(key, vars), [locale]);

  return (
    <I18nCtx.Provider value={{ t: tFn, locale, SUPPORTED_LOCALES, LOCALE_NAMES, changeLocale }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useT() {
  return useContext(I18nCtx).t;
}

export function useLocale() {
  return useContext(I18nCtx);
}
