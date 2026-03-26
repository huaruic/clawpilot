import React from 'react'
import { useRuntimeStore } from '../../stores/runtimeStore'
import type { RuntimeStatus } from '../../api/ipc'
import { useI18n } from '../../i18n/I18nProvider'

export type Page =
  | 'status'
  | 'chat'
  | 'channels'
  | 'providers'
  | 'skills'
  | 'memory'
  | 'logs'
  | 'diagnostics'
  | 'settings'

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const STATUS_COLOR: Record<RuntimeStatus, string> = {
  STOPPED: 'bg-zinc-500',
  STARTING: 'bg-yellow-500 animate-pulse',
  RUNNING: 'bg-green-500',
  ERROR: 'bg-red-500',
  UPDATING: 'bg-blue-500 animate-pulse',
}

const NAV_ITEMS: Array<{ page: Page; labelKey: string; icon: string }> = [
  { page: 'status', labelKey: 'nav.status', icon: '◉' },
  { page: 'chat', labelKey: 'nav.chat', icon: '💬' },
  { page: 'channels', labelKey: 'nav.channels', icon: '📨' },
  { page: 'providers', labelKey: 'nav.providers', icon: '🔑' },
  { page: 'skills', labelKey: 'nav.skills', icon: '⚡' },
  { page: 'memory', labelKey: 'nav.memory', icon: '🧠' },
  { page: 'logs', labelKey: 'nav.logs', icon: '📋' },
  { page: 'diagnostics', labelKey: 'nav.diagnostics', icon: '🩺' },
  { page: 'settings', labelKey: 'nav.settings', icon: '⚙' },
]

export function AppSidebar({ currentPage, onNavigate }: Props): React.ReactElement {
  const { snapshot } = useRuntimeStore()
  const { t } = useI18n()

  return (
    <aside className="w-52 flex flex-col h-full bg-zinc-950 border-r border-zinc-800 select-none shrink-0">
      {/* App header */}
      <div className="px-4 py-4 pt-8 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-white">ClawPilot</span>
          <span
            className={`w-2 h-2 rounded-full ${STATUS_COLOR[snapshot.status]}`}
            title={snapshot.status}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{snapshot.status}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ page, labelKey, icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
              currentPage === page
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <span className="w-4 text-center">{icon}</span>
            {t(labelKey)}
          </button>
        ))}
      </nav>
    </aside>
  )
}
