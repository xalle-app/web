import ru from "../locales/ru.json";
import en from "../locales/en.json";
import es from "../locales/es.json";

const LOCALES = { ru, en, es };
export const SUPPORTED_LOCALES = Object.keys(LOCALES);
export const LOCALE_NAMES = { ru: "Русский", en: "English", es: "Español" };
const DEFAULT_LOCALE = "ru";
const LS_KEY = "xalle.lang";

let _current = DEFAULT_LOCALE;

export function detectLocale(userSetting) {
  if (userSetting && SUPPORTED_LOCALES.includes(userSetting)) return userSetting;
  const saved = localStorage.getItem(LS_KEY);
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  const lang = (navigator?.language || "").split("-")[0].toLowerCase();
  if (SUPPORTED_LOCALES.includes(lang)) return lang;
  return DEFAULT_LOCALE;
}

export function setLocale(locale) {
  _current = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function setGlobalLocale(locale) {
  const l = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  localStorage.setItem(LS_KEY, l);
  _current = l;
}

export function getLocale() {
  return _current;
}

export const DATE_LOCALES = { ru: "ru-RU", en: "en-US", es: "es-ES" };

export function t(key, vars) {
  const strings = LOCALES[_current] || {};
  const fallback = LOCALES[DEFAULT_LOCALE] || {};
  let str = strings[key] ?? fallback[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
