import { useCallback, useEffect, useState } from 'react'
import { getMeta, updateMeta } from '../data/db'
import type { Locale } from './types'
import {
  detectLocale,
  LOCALE_EVENT,
  LOCALE_KEY,
  normalizeLocale,
  tr,
} from './i18n'

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale())

  useEffect(() => {
    let cancelled = false
    void getMeta().then((meta) => {
      const next = normalizeLocale(meta.locale)
      if (!cancelled) {
        localStorage.setItem(LOCALE_KEY, next)
        setLocaleState(next)
      }
    })
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_KEY) setLocaleState(normalizeLocale(event.newValue))
    }
    const onLocale = () => setLocaleState(detectLocale())
    window.addEventListener('storage', onStorage)
    window.addEventListener(LOCALE_EVENT, onLocale)
    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(LOCALE_EVENT, onLocale)
    }
  }, [])

  const setLocale = useCallback(async (next: Locale) => {
    localStorage.setItem(LOCALE_KEY, next)
    setLocaleState(next)
    window.dispatchEvent(new CustomEvent(LOCALE_EVENT))
    await updateMeta({ locale: next })
  }, [])

  const t = useCallback(
    (key: Parameters<typeof tr>[1], params?: Parameters<typeof tr>[2]) =>
      tr(locale, key, params),
    [locale],
  )

  return { locale, setLocale, t }
}
