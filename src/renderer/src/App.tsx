import React, { useState } from 'react'
import { AppSidebar, type Page } from './components/layout/AppSidebar'
import { StatusPage } from './pages/StatusPage'
import { ChatPage } from './pages/ChatPage'
import { ChannelsPage } from './pages/ChannelsPage'
import { ProvidersPage } from './pages/ProvidersPage'
import { SkillsPage } from './pages/SkillsPage'
import { MemoryPage } from './pages/MemoryPage'
import { LogsPage } from './pages/LogsPage'
import { DiagnosticsPage } from './pages/DiagnosticsPage'
import { SettingsPage } from './pages/SettingsPage'

function PageContent({ page }: { page: Page }): React.ReactElement {
  switch (page) {
    case 'status': return <StatusPage />
    case 'chat': return <ChatPage />
    case 'channels': return <ChannelsPage />
    case 'providers': return <ProvidersPage />
    case 'skills': return <SkillsPage />
    case 'memory': return <MemoryPage />
    case 'logs': return <LogsPage />
    case 'diagnostics': return <DiagnosticsPage />
    case 'settings': return <SettingsPage />
  }
}

export function App(): React.ReactElement {
  const [page, setPage] = useState<Page>('status')

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <AppSidebar currentPage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-auto">
        <PageContent page={page} />
      </main>
    </div>
  )
}
