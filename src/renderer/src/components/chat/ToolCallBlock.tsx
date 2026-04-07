import React, { useState } from 'react'
import {
  Terminal, FileText, FileEdit, Search, Globe2, Send,
  Clock, ChevronRight, ChevronDown, Loader2, Check, X,
  Cpu,
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
  search: Globe2,
  message: Send,
  cron: Clock,
  spawn: Cpu,
}

function getToolIcon(name: string): React.ComponentType<{ className?: string }> {
  if (TOOL_ICONS[name]) return TOOL_ICONS[name]
  if (name.startsWith('mcp__')) return Cpu
  return Terminal
}

function StatusIcon({ status }: { status: ToolCall['status'] }): React.ReactElement {
  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
  }
  if (status === 'error') {
    return <X className="h-3.5 w-3.5 text-destructive" />
  }
  return <Check className="h-3.5 w-3.5 text-success" />
}

/** Format the detail body: command/args + output */
function formatDetailBody(tool: ToolCall): string {
  const parts: string[] = []

  // Show the primary arg (command, path, query, etc.)
  if (tool.args) {
    parts.push(`> ${tool.args}`)
  }

  // Show output/result
  if (tool.output && tool.output.trim()) {
    if (parts.length > 0) parts.push('')  // blank line separator
    parts.push(tool.output.trim())
  }

  return parts.join('\n')
}

export function ToolCallBlock({ tool }: { tool: ToolCall }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const Icon = getToolIcon(tool.name)
  const detailBody = formatDetailBody(tool)
  const hasDetail = detailBody.length > 0

  return (
    <div className="tool-call-block">
      {/* Compact header row */}
      <button
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors rounded-lg ${
          hasDetail ? 'hover:bg-foreground/[0.03] cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Expand chevron */}
        <span className="w-4 shrink-0 text-muted-foreground/40">
          {hasDetail ? (
            expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="inline-block w-3.5" />
          )}
        </span>

        {/* Status indicator */}
        <StatusIcon status={tool.status} />

        {/* Tool icon + name */}
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[13px] font-medium text-foreground">
          {tool.displayName}
        </span>

        {/* Args preview (only when collapsed) */}
        {!expanded && tool.args && (
          <code className="ml-1 truncate text-[12px] text-muted-foreground/60 font-mono max-w-[55%]">
            {tool.args}
          </code>
        )}

        {/* Running indicator */}
        {tool.status === 'running' && (
          <span className="ml-auto flex items-center gap-0.5">
            <span className="streaming-dot" style={{ animationDelay: '0ms' }} />
            <span className="streaming-dot" style={{ animationDelay: '200ms' }} />
            <span className="streaming-dot" style={{ animationDelay: '400ms' }} />
          </span>
        )}
      </button>

      {/* Expanded detail block */}
      {expanded && hasDetail && (
        <div className="mx-3 mb-2 ml-[2.25rem] overflow-hidden rounded-lg border border-border/40 bg-muted/40">
          <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed text-foreground/80 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
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
  const Icon = primaryToolIcon ? getToolIcon(primaryToolIcon) : Terminal

  const parts: string[] = []
  if (toolCount > 0) parts.push(`${toolCount} tool call${toolCount > 1 ? 's' : ''}`)
  if (messageCount > 0) parts.push(`${messageCount} message${messageCount > 1 ? 's' : ''}`)
  const summary = parts.join(', ')

  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-1 py-2 text-left transition-colors hover:bg-foreground/[0.03] rounded-lg"
    >
      {expanded
        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
      }
      <span className="text-[13px] text-muted-foreground">
        {summary}
      </span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
    </button>
  )
}
