"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { de } from "./messages/de";
import { en, type Messages } from "./messages/en";
import { id } from "./messages/id";
import { ja } from "./messages/ja";
import { zhCN } from "./messages/zh-CN";

export type Locale = "en" | "zh-CN" | "ja" | "de" | "id";

/** Interface languages, in the order the switcher lists them. `intl` drives number and date formatting. */
export const LOCALES: { code: Locale; label: string; intl: string }[] = [
  { code: "en", label: "English", intl: "en-GB" },
  { code: "zh-CN", label: "简体中文", intl: "zh-CN" },
  { code: "ja", label: "日本語", intl: "ja-JP" },
  { code: "de", label: "Deutsch", intl: "de-DE" },
  { code: "id", label: "Bahasa Indonesia", intl: "id-ID" },
];

const MESSAGES: Record<Locale, Messages> = { en, "zh-CN": zhCN, ja, de, id };
const STORAGE_KEY = "osl-locale";

function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

/** First browser language we have, else English. */
function detectLocale(): Locale {
  const wanted = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of wanted) {
    const lower = tag.toLowerCase();
    if (lower.startsWith("zh")) return "zh-CN";
    if (lower.startsWith("ja")) return "ja";
    if (lower.startsWith("de")) return "de";
    if (lower.startsWith("id") || lower.startsWith("in")) return "id";
    if (lower.startsWith("en")) return "en";
  }
  return "en";
}

export interface Formatters {
  /** Whole numbers, "—" for missing values. */
  int: (n: number | null | undefined) => string;
  /** Short form above 10,000 (12K, 1.2万). */
  compact: (n: number | null | undefined) => string;
  credits: (n: number | null | undefined) => string;
  dateTime: (iso: string | null | undefined) => string;
  /** Day and month, e.g. 26 Nov / 11月26日. */
  shortDate: (date: Date) => string;
  /** Compact age: now, 5m, 3h, 2d, then a date. */
  timeAgo: (iso: string | null | undefined, now?: Date) => string;
}

function makeFormatters(intl: string, m: Messages): Formatters {
  // English keeps US digit grouping (1,234), as before.
  const numberLocale = intl === "en-GB" ? "en-US" : intl;
  const intFmt = new Intl.NumberFormat(numberLocale);
  const compactFmt = new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 });
  const shortDateFmt = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
  const dateTimeFmt = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const int = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? "—" : intFmt.format(Math.round(n)));
  return {
    int,
    compact: (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : n < 10_000 ? intFmt.format(n) : compactFmt.format(n)),
    credits: (n) => (n === null || n === undefined ? "—" : m.common.credits(int(n))),
    dateTime: (iso) => {
      if (!iso) return "—";
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
    },
    shortDate: (date) => shortDateFmt.format(date),
    timeAgo: (iso, now = new Date()) => {
      if (!iso) return "";
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return "";
      const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
      if (s < 60) return m.time.now;
      const minutes = Math.round(s / 60);
      if (minutes < 60) return m.time.minutes(minutes);
      const hours = Math.round(minutes / 60);
      if (hours < 24) return m.time.hours(hours);
      const days = Math.round(hours / 24);
      if (days < 30) return m.time.days(days);
      return shortDateFmt.format(new Date(t));
    },
  };
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  m: Messages;
  fmt: Formatters;
}

const FORMATTERS = Object.fromEntries(LOCALES.map((l) => [l.code, makeFormatters(l.intl, MESSAGES[l.code])])) as Record<Locale, Formatters>;

/** Messages of the active language for code outside React (toasts built from API errors). */
let activeMessages: Messages = en;
export function currentMessages(): Messages {
  return activeMessages;
}

const Ctx = createContext<I18nValue>({ locale: "en", setLocale: () => {}, m: en, fmt: FORMATTERS.en });

/**
 * The server and the first client render use English (the HTML is static in the demo), then the saved or
 * browser language takes over on mount.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked: fall back to the browser language.
    }
    setLocaleState(isLocale(saved) ? saved : detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    // A short fade (globals.css .osl-locale-switch) so the new language does not snap in.
    const root = document.documentElement;
    root.classList.remove("osl-locale-switch");
    void root.offsetWidth;
    root.classList.add("osl-locale-switch");
    window.setTimeout(() => root.classList.remove("osl-locale-switch"), 300);
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted; the choice still applies to this visit.
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    activeMessages = MESSAGES[locale];
    return { locale, setLocale, m: MESSAGES[locale], fmt: FORMATTERS[locale] };
  }, [locale, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(Ctx);
}

export type { Messages };
