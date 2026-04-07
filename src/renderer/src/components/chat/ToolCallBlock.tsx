import React, { useState } from 'react'
import {
  Terminal, FileText, FileEdit, Search, Globe2, Send,
  Clock, ChevronRight, ChevronDown, Loader2, Check, X,
  Cpu, Wrench
} from 'lucide-react'
import type { ToolCall } from '../../stores/chatStore'

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  exec: Terminal,
  process: Terminal,
  read: FileText,
  write: FileEdit,
  edit: FileEdit,
  glob: Search,
  grep: Search,
  web_search: Globe2,
  search: Search,
  message: Send,
  cron: Clock,
  spawn: Cpu,
}

const TOOL_LABELS: Record<string, string> = {
  exec: 'Running command',
  process: 'Running process',
  read: 'Reading file',
  write: 'Writing file',
  edit: 'Editing file',
  glob: 'Searching files',
  grep: 'Searching file content',
  web_search: 'Searching the web',
  search: 'Searching',
  message: 'Sending message',
  cron: 'Scheduling task',
  spawn: 'Starting process',
}

function getToolIcon(name: string): React.ComponentType<{ className?: string }> {
  if (TOOL_ICONS[name]) return TOOL_ICONS[name]
  if (name.startsWith('mcp__')) return Wrench
  return Wrench
}

function getToolLabel(tool: ToolCall): string {
  const baseLabel = TOOL_LABELS[tool.name] || `Using ${tool.displayName || tool.name}`
  if (tool.status === 'running') return `${baseLabel}...`
  if (tool.status === 'error') return `Failed ${baseLabel.toLowerCase()}`
  return `Finished ${baseLabel.toLowerCase()}`
}

function StatusIcon({ status }: { status: ToolCall['status'] }): React.ReactElement {
  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
  }
  if (status === 'error') {
    return <X className="h-3.5 w-3.5 text-destructive" />
  }
  return <Check className="h-3.5 w-3.5 text-muted-foreground/60" />
}

/** Format the detail body: command/args + output */
function formatDetailBody(tool: ToolCall): string {
  const parts: string[] = []
  if (tool.args) parts.push(`> ${tool.args}`)
  if (tool.output && tool.output.trim()) {
    if (parts.length > 0) parts.push('')
    parts.push(tool.output.trim())
  }
  return parts.join('\n')
}

export function ToolCallBlock({ tool }: { tool: ToolCall }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const Icon = getToolIcon(tool.name)
  const detailBody = formatDetailBody(tool)
  const hasDetail = detailBody.length > 0
  const label = getToolLabel(tool)

  return (
    <div className="mb-2 last:mb-0">
      <button
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={`clickable flex w-full items-center gap-3 px-3 py-2 text-left transition-all rounded-xl border border-border/40 bg-card/60 shadow-sm ${
          hasDetail ? 'hover:bg-card hover:border-border/60 hover:shadow-md cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Status or loading icon */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border/50 shrink-0">
          <StatusIcon status={tool.status} />
        </div>

        {/* Text and Icon */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <span className="text-[14px] font-medium text-foreground/90 truncate">
            {label}
          </span>
        </div>

        {/* Expand chevron */}
        {hasDetail && (
          <span className="shrink-0 text-muted-foreground/40 pl-2 border-l border-border/40">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        )}
      </button>

      {/* Expanded detail block */}
      {expanded && hasDetail && (
        <div className="mt-1.5 ml-2 mr-2 overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm">
          <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-muted-foreground font-mono whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
            {detailBody}
          </pre>
        </div>
      )}
    </div>
  )
}

/** Summary header for the entire tool call container */
export function ToolCallSummaryHeader({
  toolCount,
  messageCount,
  expanded,
  onToggle,
  primaryToolIcon,
}: {
  toolCount: number
  messageCount: number
  expanded: boolean
  onToggle: () => void
  primaryToolIcon?: string
}): React.ReactElement {
  const Icon = primaryToolIcon ? getToolIcon(primaryToolIcon) : Wrench

  const parts: string[] = []
  if (toolCount > 0) parts.push(`${toolCount} action${toolCount > 1 ? 's' : ''}`)
  if (messageCount > 0) parts.push(`${messageCount} message${messageCount > 1 ? 's' : ''}`)
  const summary = parts.join(', ') || 'Working'

  return (
    <button
      onClick={onToggle}
      className="clickable group flex w-fit items-center gap-2.5 px-3 py-1.5 mb-2 text-left transition-all rounded-full bg-card border border-border/40 shadow-sm hover:shadow-md hover:border-border/60"
    >
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary">
        <Icon className="h-3 w-3" />
      </div>
      <span className="text-[13px] font-medium text-foreground/80 group-hover:text-foreground transition-colors">
        {expanded ? 'Hide details' : summary}
      </span>
      {expanded
        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
      }
    </button>
  )
}
