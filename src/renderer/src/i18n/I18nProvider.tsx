import React, { createContext, useContext, useEffect, useState } from 'react'
import type { AppLanguage, AppSettings } from '../api/ipc'
import { messages, type MessageSchema } from './messages'

interface I18nContextValue {
  settings: AppSettings
  systemLocale: string
  resolvedLanguage: Exclude<AppLanguage, 'system'>
  t: (key: string) => string
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

const I18nContext = createContext<I18nContextValue | null>(null)

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getNestedMessage(locale: MessageSchema, key: string): string | undefined {
  let current: unknown = locale
  for (const segment of key.split('.')) {
    if (!isObject(current) || !(segment in current)) {
      return undefined
    }
    current = current[segment]
  }
  return typeof current === 'string' ? current : undefined
}

function resolveLanguage(language: AppLanguage, systemLocale: string): 'zh-CN' | 'en' {
  if (language === 'zh-CN' || language === 'en') {
    return language
  }
  return systemLocale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export function I18nProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>({ language: 'system', theme: 'system' })
  const [systemLocale, setSystemLocale] = useState('en')

  useEffect(() => {
    let cancelled = false

    Promise.all([
      window.catclaw.app.getSettings(),
      window.catclaw.app.getSystemLocale(),
    ]).then(([nextSettings, nextSystemLocale]) => {
      if (cancelled) return
      setSettings(nextSettings)
      setSystemLocale(nextSystemLocale)
    }).catch(() => {
      if (cancelled) return
      setSystemLocale('en')
    })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
    const applyTheme = (): void => {
      const effectiveTheme = settings.theme === 'system'
        ? (mediaQuery?.matches ? 'dark' : 'light')
        : settings.theme
      document.documentElement.dataset.theme = effectiveTheme
    }

    applyTheme()
    if (settings.theme !== 'system' || !mediaQuery) {
      return
    }

    const handler = (): void => applyTheme()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }

    mediaQuery.addListener(handler)
    return () => mediaQuery.removeListener(handler)
  }, [settings.theme])

  const resolvedLanguage = resolveLanguage(settings.language, systemLocale)

  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    const nextSettings = await window.catclaw.app.updateSettings(patch)
    setSettings(nextSettings)
  }

  function t(key: string): string {
    return getNestedMessage(messages[resolvedLanguage], key)
      ?? getNestedMessage(messages.en, key)
      ?? key
  }

  return (
    <I18nContext.Provider value={{ settings, systemLocale, resolvedLanguage, t, updateSettings }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider')
  }
  return value
}
