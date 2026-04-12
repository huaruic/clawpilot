import React, { useState } from 'react'
import { AppSidebar, type Page } from './components/layout/AppSidebar'
import { SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/sonner'
import { DashboardPage } from './pages/DashboardPage'
import { ChatPage } from './pages/ChatPage'
import { ProvidersPage } from './pages/ProvidersPage'
import { ChannelsPage } from './pages/ChannelsPage'
import { AgentsPage } from './pages/AgentsPage'
import { SkillsPage } from './pages/SkillsPage'
import { PersonaPage } from './pages/PersonaPage'
import { SecurityPage } from './pages/SecurityPage'
import { DiagnosticsPage } from './pages/DiagnosticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { AllChatsPage } from './pages/AllChatsPage'

function PageContent({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }): React.ReactElement {
  switch (page) {
    case 'dashboard': return <DashboardPage />
    case 'chat': return <ChatPage onNavigate={onNavigate} />
    case 'providers': return <ProvidersPage />
    case 'channels': return <ChannelsPage />
    case 'agents': return <AgentsPage />
    case 'skills': return <SkillsPage onNavigate={onNavigate} />
    case 'persona': return <PersonaPage />
    case 'security': return <SecurityPage />
    case 'doctor': return <DiagnosticsPage />
    case 'settings': return <SettingsPage />
    case 'allChats': return <AllChatsPage onNavigate={onNavigate} />
  }
}

export function App(): React.ReactElement {
  const [page, setPage] = useState<Page>('chat')

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <AppSidebar currentPage={page} onNavigate={setPage} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center px-4">
              <SidebarTrigger />
            </header>
            <main className="axiom-gradient min-h-0 flex-1 overflow-auto">
              <PageContent page={page} onNavigate={setPage} />
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </TooltipProvider>
  )
}
