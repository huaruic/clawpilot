import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart3,
  Radio,
  Bot,
  Users,
  Puzzle,
  Theater,
  Shield,
  Stethoscope,
  Settings,
  Plus,
  Trash2,
  Search,
  Clock,
  Server,
  VenetianMask,
  PawPrint,
} from 'lucide-react'
import { useRuntimeStore } from '../../stores/runtimeStore'
import { useChatStore } from '../../stores/chat'
import { deleteSession } from '../../services/chatService'
import type { SessionSummary } from '../../types'
import type { RuntimeStatus } from '../../api/ipc'
import { useI18n } from '../../i18n/I18nProvider'
import { SearchDialog } from '../chat/SearchDialog'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar'

export type Page =
  | 'dashboard'
  | 'chat'
  | 'providers'
  | 'channels'
  | 'agents'
  | 'skills'
  | 'persona'
  | 'security'
  | 'doctor'
  | 'settings'
  | 'allChats'

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

const STATUS_LABEL: Record<RuntimeStatus, string> = {
  STOPPED: 'Stopped',
  STARTING: 'Starting\u2026',
  RUNNING: 'Running',
  ERROR: 'Error',
  UPDATING: 'Updating\u2026',
}

const NAV_ITEMS: Array<{ page: Page; labelKey: string; icon: React.ElementType }> = [
  { page: 'dashboard', labelKey: 'nav.dashboard', icon: BarChart3 },
  { page: 'providers', labelKey: 'nav.providers', icon: Bot },
  { page: 'channels', labelKey: 'nav.channels', icon: Radio },
  { page: 'agents', labelKey: 'nav.agents', icon: Users },
  { page: 'skills', labelKey: 'nav.skills', icon: Puzzle },
  { page: 'persona', labelKey: 'nav.persona', icon: Theater },
  { page: 'security', labelKey: 'nav.security', icon: Shield },
  { page: 'doctor', labelKey: 'nav.doctor', icon: Stethoscope },
]

/* ── Session Item ── */

function SessionItem({
  session,
  active,
  onClick,
  onDelete,
  deleteLabel,
}: {
  session: SessionSummary
  active: boolean
  onClick: () => void
  onDelete: (key: string) => void
  deleteLabel: string
}): React.ReactElement {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div
      className={`group relative flex w-full items-center rounded-lg transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
      }`}
    >
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 flex-col px-2 py-1.5 text-left"
      >
        <span className="truncate text-[13px] font-medium leading-snug">{session.title}</span>
      </button>
      {confirmingDelete ? (
        <div className="flex shrink-0 items-center gap-1 pr-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.key); setConfirmingDelete(false) }}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-danger hover:bg-danger/10"
          >
            {deleteLabel}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false) }}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true) }}
          className="shrink-0 p-1.5 mr-1 rounded opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-danger"
          title={deleteLabel}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

/* ── AppSidebar ── */

export function AppSidebar({ currentPage, onNavigate }: Props): React.ReactElement {
  const { snapshot } = useRuntimeStore()
  const { t } = useI18n()
  const { collapsed } = useSidebar()
  const { activeSession, setActiveSession, sessionListVersion, sessionLabels, newSession, bumpSessionList, sessions, fetchSessions, removeSession } = useChatStore()

  const [searchOpen, setSearchOpen] = useState(false)

  // Fetch sessions whenever runtime becomes running or session list is bumped.
  useEffect(() => {
    if (snapshot.status !== 'RUNNING' || !snapshot.wsConnected) return
    void fetchSessions()
  }, [snapshot.status, snapshot.startedAt, snapshot.wsConnected, sessionListVersion, fetchSessions])

  // Build session list with fallback to local sessionLabels when gateway returns empty.
  const mergedSessions = React.useMemo(() => {
    let base = sessions

    if (base.length === 0 && Object.keys(sessionLabels).length > 0) {
      base = Object.entries(sessionLabels)
        .filter(([, label]) => label)
        .map(([key, label]) => ({
          key,
          title: label,
          preview: '',
          updatedAt: undefined,
        }))
    }

    if (activeSession && !base.some((s) => s.key === activeSession)) {
      const label = sessionLabels[activeSession]
      if (label || useChatStore.getState().messages[activeSession]?.length) {
        base = [{ key: activeSession, title: label || 'New Chat', preview: '', updatedAt: Date.now() }, ...base]
      }
    }

    return base
  }, [sessions, activeSession, sessionLabels])

  const displayStatus: RuntimeStatus =
    snapshot.status !== 'RUNNING' && (!snapshot.setup.hasProvider || !snapshot.setup.hasDefaultModel)
      ? 'STOPPED'
      : snapshot.status

  const handleDeleteSession = useCallback(async (key: string) => {
    try {
      await deleteSession(key)
    } catch {
      // non-fatal
    }
    removeSession(key)
    useChatStore.getState().setSessionLabel(key, '')
    if (key === activeSession) {
      newSession('default')
    }
    bumpSessionList()
  }, [activeSession, newSession, bumpSessionList, removeSession])

  function handleNewChat(): void {
    newSession('default')
    onNavigate('chat')
  }

  function handleSelectSession(key: string): void {
    setActiveSession(key)
    onNavigate('chat')
  }

  return (
    <Sidebar className="select-none border-r border-border">
      {/* Logo + runtime status (macOS drag region) */}
      <div className="flex items-center gap-2 p-4 pt-10 [-webkit-app-region:drag]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          <PawPrint className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground">CatClaw</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[displayStatus]}`} title={displayStatus} />
              <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[displayStatus]}</span>
            </div>
          </div>
        )}
      </div>

      <SidebarContent className="!flex !flex-col !overflow-hidden">
        {/* New Chat + Search button */}
        <SidebarGroup className="shrink-0 pt-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {/* New Chat */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleNewChat}
                  className={collapsed ? 'justify-center px-2' : undefined}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t('nav.newChat')}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Search — button that opens modal */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setSearchOpen(true)}
                  className={collapsed ? 'justify-center px-2' : undefined}
                >
                  <Search className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">Search</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation items */}
        <SidebarGroup className="shrink-0 pt-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ page, labelKey, icon: Icon }) => (
                <SidebarMenuItem key={page}>
                  <SidebarMenuButton
                    onClick={() => onNavigate(page)}
                    aria-current={currentPage === page ? 'page' : undefined}
                    active={currentPage === page}
                    className={collapsed ? 'justify-center px-2' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{t(labelKey)}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Recents — chat session list */}
        {!collapsed && mergedSessions.length > 0 && (
          <div className="mt-1 flex min-h-0 flex-1 flex-col">
            {/* Section label */}
            <div className="px-3 pb-1">
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground/60">
                Recents
              </p>
            </div>
            {/* Session list — scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <div className="space-y-px">
                {mergedSessions.map((session) => (
                  <SessionItem
                    key={session.key}
                    session={session}
                    active={session.key === activeSession}
                    onClick={() => handleSelectSession(session.key)}
                    onDelete={handleDeleteSession}
                    deleteLabel={t('app.chat.deleteSession')}
                  />
                ))}
              </div>

              {/* All chats — at the bottom of scrollable area */}
              <div className="mt-2 pt-2">
                <SidebarMenuButton
                  onClick={() => onNavigate('allChats')}
                  active={currentPage === 'allChats'}
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  <span className="truncate">All chats</span>
                </SidebarMenuButton>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>

      {/* Settings footer */}
      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onNavigate('settings')}
              aria-current={currentPage === 'settings' ? 'page' : undefined}
              active={currentPage === 'settings'}
              className={collapsed ? 'justify-center px-2' : undefined}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{t('nav.settings')}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Search modal */}
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        sessions={mergedSessions}
        onSelectSession={handleSelectSession}
      />
    </Sidebar>
  )
}
