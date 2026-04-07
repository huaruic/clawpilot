import React from 'react'
import { Loader2, Terminal, FileText, Search, Globe2, Cpu, Sparkles } from 'lucide-react'
import type { ChatMessage } from '../../stores/chatStore'

type StreamPhase = 'thinking' | 'generating' | 'tool_running' | 'processing'

interface StreamStatus {
  phase: StreamPhase
  label: string
  detail?: string
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  exec: Terminal,
  process: Terminal,
  read: FileText,
  write: FileText,
  edit: FileText,
  glob: Search,
  grep: Search,
  web_search: Globe2,
  search: Globe2,
}

function deriveStreamStatus(messages: ChatMessage[]): StreamStatus {
  if (!messages || messages.length === 0) {
    return { phase: 'thinking', label: 'Thinking' }
  }

  const last = messages[messages.length - 1]

  // Last message is user → waiting for LLM to start
  if (last.role === 'user') {
    return { phase: 'thinking', label: 'Thinking' }
  }

  // Last message is assistant
  if (last.role === 'assistant') {
    const runningTools = last.toolCalls?.filter((tc) => tc.status === 'running') ?? []

    // Has running tool calls → show which tool
    if (runningTools.length > 0) {
      const tool = runningTools[runningTools.length - 1]
      return {
        phase: 'tool_running',
        label: tool.displayName,
        detail: tool.args,
      }
    }

    // Has completed tool calls but no/little content → processing results
    const doneTools = last.toolCalls?.filter((tc) => tc.status === 'done') ?? []
    if (doneTools.length > 0 && last.content.trim().length < 10) {
      return { phase: 'processing', label: 'Processing results' }
    }

    // Has content → generating
    if (last.content.trim().length > 0) {
      return { phase: 'generating', label: 'Generating' }
    }

    // No content yet → thinking
    return { phase: 'thinking', label: 'Thinking' }
  }

  return { phase: 'thinking', label: 'Thinking' }
}

function PhaseIcon({ phase, toolName }: { phase: StreamPhase; toolName?: string }): React.ReactElement {
  if (phase === 'tool_running') {
    const Icon = (toolName && TOOL_ICONS[toolName]) || Terminal
    return <Icon className="h-3.5 w-3.5" />
  }
  if (phase === 'generating') {
    return <Sparkles className="h-3.5 w-3.5" />
  }
  if (phase === 'processing') {
    return <Cpu className="h-3.5 w-3.5" />
  }
  // thinking
  return <Loader2 className="h-3.5 w-3.5 animate-spin" />
}

export function StreamingStatusBar({
  messages,
}: {
  messages: ChatMessage[]
}): React.ReactElement {
  const status = deriveStreamStatus(messages)

  // Find running tool's raw name for icon lookup
  const lastMsg = messages[messages.length - 1]
  const runningTool = lastMsg?.role === 'assistant'
    ? lastMsg.toolCalls?.find((tc) => tc.status === 'running')
    : undefined

  return (
    <div className="flex items-center gap-2.5 py-2 px-1">
      {/* Animated dot */}
      <div className="relative flex h-5 w-5 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-primary/15 streaming-pulse" />
        <PhaseIcon phase={status.phase} toolName={runningTool?.name} />
      </div>

      {/* Status text */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[13px] font-medium text-muted-foreground streaming-status-text">
          {status.label}
        </span>
        {status.detail && (
          <code className="truncate text-[11px] text-muted-foreground/60 font-mono max-w-[300px]">
            {status.detail}
          </code>
        )}
      </div>

      {/* Animated dots */}
      <span className="flex items-center gap-0.5">
        <span className="streaming-dot" style={{ animationDelay: '0ms' }} />
        <span className="streaming-dot" style={{ animationDelay: '200ms' }} />
        <span className="streaming-dot" style={{ animationDelay: '400ms' }} />
      </span>
    </div>
  )
}
