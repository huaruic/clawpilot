import React, { useState } from 'react'
import { Brain, ChevronRight, ChevronDown } from 'lucide-react'
import type { ThinkingBlock as ThinkingBlockType } from '../../stores/chatStore'

export function ThinkingBlock({ block, isStreaming }: { block: ThinkingBlockType; isStreaming?: boolean }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const content = block.content.trim()
  const hasContent = content.length > 0

  // Preview: first line, truncated
  const preview = content.split('\n')[0]?.slice(0, 80) || ''

  return (
    <div className="thinking-block group">
      <button
        onClick={() => hasContent && setExpanded(!expanded)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors rounded-lg ${
          hasContent ? 'hover:bg-foreground/[0.03] cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Expand chevron */}
        <span className="w-4 shrink-0 text-muted-foreground/50">
          {hasContent ? (
            expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
          ) : null}
        </span>

        {/* Icon */}
        <Brain className={`h-3.5 w-3.5 ${isStreaming ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />

        {/* Label */}
        <span className={`text-[13px] font-medium ${isStreaming ? 'text-primary thinking-shimmer' : 'text-muted-foreground'}`}>
          Thinking
        </span>

        {/* Preview text (when collapsed) */}
        {!expanded && preview && (
          <span className="ml-1 truncate text-[12px] text-muted-foreground/50 font-mono max-w-[60%]">
            {preview}
          </span>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="ml-auto flex items-center gap-0.5">
            <span className="streaming-dot" style={{ animationDelay: '0ms' }} />
            <span className="streaming-dot" style={{ animationDelay: '200ms' }} />
            <span className="streaming-dot" style={{ animationDelay: '400ms' }} />
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && hasContent && (
        <div className="mx-3 mb-2 ml-9 overflow-hidden rounded-lg border border-border/50 bg-[hsl(var(--muted)/0.5)]">
          <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed text-foreground/80 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}
