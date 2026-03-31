import React from 'react'
import { useRuntimeStore } from '../../stores/runtimeStore'
import type { RuntimeStatus } from '../../api/ipc'
import { useI18n } from '../../i18n/I18nProvider'
import {
  IconBolt,
  IconChannels,
  IconChat,
  IconKey,
  IconMemory,
  IconPulse,
  IconSettings,
  IconStatus,
} from '../icons'

export type Page =
  | 'status'
  | 'chat'
  | 'channels'
  | 'providers'
  | 'skills'
  | 'memory'
  | 'diagnostics'
  | 'settings'

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const STATUS_COLOR: Record<RuntimeStatus, string> = {
  STOPPED: 'bg-muted-foreground',
  STARTING: 'bg-warning animate-pulse',
  RUNNING: 'bg-success',
  ERROR: 'bg-danger',
  UPDATING: 'bg-primary animate-pulse',
}

const NAV_ITEMS: Array<{ page: Page; labelKey: string; icon: React.ReactElement }> = [
  { page: 'status', labelKey: 'nav.status', icon: <IconStatus /> },
  { page: 'chat', labelKey: 'nav.chat', icon: <IconChat /> },
  { page: 'channels', labelKey: 'nav.channels', icon: <IconChannels /> },
  { page: 'providers', labelKey: 'nav.providers', icon: <IconKey /> },
  { page: 'skills', labelKey: 'nav.skills', icon: <IconBolt /> },
  { page: 'memory', labelKey: 'nav.memory', icon: <IconMemory /> },
  { page: 'diagnostics', labelKey: 'nav.diagnostics', icon: <IconPulse /> },
  { page: 'settings', labelKey: 'nav.settings', icon: <IconSettings /> },
]

export function AppSidebar({ currentPage, onNavigate }: Props): React.ReactElement {
  const { snapshot } = useRuntimeStore()
  const { t } = useI18n()

  return (
    <aside className="w-56 flex flex-col h-full bg-surface border-r border-border select-none shrink-0">
      {/* App header */}
      <div className="px-4 py-4 pt-8 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-foreground tracking-tight">ClawPilot</span>
          <span
            className={`w-2 h-2 rounded-full ${STATUS_COLOR[snapshot.status]}`}
            title={snapshot.status}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{snapshot.status}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ page, labelKey, icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            aria-current={currentPage === page ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left rounded-xl mx-2 ${
              currentPage === page
                ? 'bg-surface-2 text-foreground border border-border/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-2/60'
            } focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
          >
            <span className="w-4 text-center shrink-0 text-current">{icon}</span>
            <span className="truncate">{t(labelKey)}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
