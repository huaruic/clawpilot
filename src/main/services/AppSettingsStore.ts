import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type AppLanguage = 'system' | 'zh-CN' | 'en'

export interface AppSettings {
  language: AppLanguage
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'system',
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function normalizeSettings(raw: unknown): AppSettings {
  const language = (raw as { language?: unknown } | null)?.language
  return {
    language: language === 'zh-CN' || language === 'en' || language === 'system'
      ? language
      : DEFAULT_SETTINGS.language,
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
