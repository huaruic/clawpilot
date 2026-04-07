import * as React from 'react'
import { cn } from '../../lib/utils'

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [collapsed, setCollapsed] = React.useState(false)
  const value = React.useMemo(() => ({
    collapsed,
    toggle: () => setCollapsed((current) => !current),
  }), [collapsed])

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar(): SidebarContextValue {
  const value = React.useContext(SidebarContext)
  if (!value) throw new Error('useSidebar must be used within SidebarProvider')
  return value
}

export function SidebarTrigger({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>): React.ReactElement {
  const { toggle } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M4 5h12" />
        <path d="M4 10h12" />
        <path d="M4 15h12" />
      </svg>
    </button>
  )
}

export function Sidebar({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  const { collapsed } = useSidebar()
  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar',
        collapsed ? 'w-[84px]' : 'w-[272px]',
        className,
      )}
    >
      {children}
    </aside>
  )
}

export function SidebarContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('flex-1 overflow-y-auto px-3 pb-4', className)} {...props} />
}

export function SidebarGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('space-y-2', className)} {...props} />
}

export function SidebarGroupContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('space-y-1', className)} {...props} />
}

export function SidebarMenu({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('space-y-1', className)} {...props} />
}

export function SidebarMenuItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('', className)} {...props} />
}

export function SidebarMenuButton({
  className,
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }): React.ReactElement {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
        active
          ? 'bg-sidebar-accent text-primary font-medium'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('border-t border-sidebar-border p-3', className)} {...props} />
}
