import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type AppLanguage = 'system' | 'zh-CN' | 'en'
export type AppTheme = 'system' | 'light' | 'dark'

export interface AppSettings {
  language: AppLanguage
  theme: AppTheme
  onboardedStarterPack: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'system',
  theme: 'system',
  onboardedStarterPack: false,
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function normalizeSettings(raw: unknown): AppSettings {
  const language = (raw as { language?: unknown } | null)?.language
  const theme = (raw as { theme?: unknown } | null)?.theme
  const onboardedStarterPack = (raw as { onboardedStarterPack?: unknown } | null)?.onboardedStarterPack
  return {
    language: language === 'zh-CN' || language === 'en' || language === 'system'
      ? language
      : DEFAULT_SETTINGS.language,
    theme: theme === 'light' || theme === 'dark' || theme === 'system'
      ? theme
      : DEFAULT_SETTINGS.theme,
    onboardedStarterPack: typeof onboardedStarterPack === 'boolean'
      ? onboardedStarterPack
      : DEFAULT_SETTINGS.onboardedStarterPack,
  }
}

export async function readAppSettings(): Promise<AppSettings> {
  try {
    const content = await readFile(getSettingsPath(), 'utf-8')
    return normalizeSettings(JSON.parse(content))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = normalizeSettings({ ...(await readAppSettings()), ...patch })
  const settingsPath = getSettingsPath()
  await mkdir(dirname(settingsPath), { recursive: true })
  await writeFile(settingsPath, JSON.stringify(next, null, 2), 'utf-8')
  return next
}

export function getSystemLocale(): string {
  return app.getLocale()
}
