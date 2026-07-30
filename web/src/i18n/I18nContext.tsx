import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './en'
import zh from './zh'
import type { Locale, Messages } from './types'

const STORAGE_KEY = 'cursor-flash.locale'

const catalogs: Record<Locale, Messages> = { zh, en }

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  const lang = navigator.language.toLowerCase()
  return lang.startsWith('zh') ? 'zh' : 'en'
}

function getByPath(obj: Messages, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  )
}

type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  describeCategory: (category: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const msg = getByPath(catalogs[locale], key) ?? getByPath(catalogs.en, key) ?? key
      return interpolate(msg, vars)
    },
    [locale],
  )

  const describeCategory = useCallback(
    (category: string) => {
      const map = catalogs[locale].categoryDesc
      const fallback = catalogs.en.categoryDesc
      const desc = map[category] ?? fallback[category]
      if (desc) return desc
      const unknown = map.unknown ?? fallback.unknown ?? category
      return interpolate(unknown, { category })
    },
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t, describeCategory }),
    [locale, setLocale, t, describeCategory],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useT() {
  return useI18n().t
}
