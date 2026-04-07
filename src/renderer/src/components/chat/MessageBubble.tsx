import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy } from 'lucide-react'
import type { ChatMessage, ToolCall, ThinkingBlock as ThinkingBlockType } from '../../stores/chatStore'
import { ToolCallBlock, ToolCallSummaryHeader } from './ToolCallBlock'
import { ThinkingBlock } from './ThinkingBlock'
import { CodeBlock, InlineCode } from './CodeBlock'

interface Props {
  message: ChatMessage
}

export function MessageBubble({ message }: Props): React.ReactElement {
  const isUser = message.role === 'user'
  const isStreaming = message.state === 'streaming'
  const isError = message.state === 'error'
  const hasToolCalls = !isUser && message.toolCalls && message.toolCalls.length > 0
  const hasThinking = !isUser && message.thinkingBlocks && message.thinkingBlocks.length > 0
  const hasContent = message.content.trim().length > 0
  const hasBlocks = hasToolCalls || hasThinking

  /* ── User message: right-aligned pill ── */
  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[75%] rounded-2xl bg-primary/15 px-4 py-2.5 text-sm text-foreground">
          <pre className="m-0 whitespace-pre-wrap break-words font-sans">{message.content}</pre>
        </div>
        <span className="text-[11px] text-muted-foreground/50 font-mono tabular-nums px-1">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    )
  }

  /* ── Build interleaved blocks (thinking + tool calls sorted by index) ── */
  const interleavedBlocks = buildInterleavedBlocks(message)
  const toolCount = message.toolCalls?.length ?? 0
  const thinkingCount = message.thinkingBlocks?.length ?? 0
  const hasRunningTool = message.toolCalls?.some((tc) => tc.status === 'running')
  // Auto-expand while streaming (running tools), collapse when done
  const defaultExpanded = isStreaming || !!hasRunningTool

  /* ── Assistant message: left-aligned, no border, full width ── */
  return (
    <div className="group relative">
      {/* Interleaved thinking + tool call blocks */}
      {hasBlocks && (
        <CollapsibleBlockContainer
          toolCount={toolCount}
          messageCount={thinkingCount + (hasContent ? 1 : 0)}
          defaultExpanded={defaultExpanded}
          primaryToolIcon={message.toolCalls?.[0]?.name}
        >
          {interleavedBlocks.map((block, i) =>
            block.type === 'thinking' ? (
              <ThinkingBlock
                key={`thinking-${i}`}
                block={block.data as ThinkingBlockType}
                isStreaming={isStreaming && block.isLast}
              />
            ) : (
              <ToolCallBlock key={(block.data as ToolCall).id} tool={block.data as ToolCall} />
            )
          )}
        </CollapsibleBlockContainer>
      )}

      {/* Text content */}
      {(hasContent || isError) && (
        <div className={`text-[15px] leading-relaxed ${
          isError
            ? 'rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive'
            : 'text-foreground'
        }`}>
          {isError ? (
            <pre className="m-0 whitespace-pre-wrap break-words font-sans">{message.content}</pre>
          ) : (
            <div className={`chat-markdown break-words ${isStreaming ? 'streaming-content' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    const { className, children, node, ...rest } = props
                    const match = /language-(\w+)/.exec(className ?? '')
                    const code = String(children).replace(/\n$/, '')

                    // Detect block code: has language class, or parent is <pre> (node check),
                    // or contains newlines (multi-line = fenced block without language)
                    const isBlock = !!match || code.includes('\n') || node?.position?.start.line !== node?.position?.end.line

                    if (!isBlock) {
                      return <InlineCode {...rest}>{children}</InlineCode>
                    }

                    return <CodeBlock code={code} language={match?.[1]} />
                  },
                  // Prevent react-markdown from wrapping CodeBlock in <pre>
                  pre({ children }) {
                    return <>{children}</>
                  },
                  a(props) {
                    return <a {...props} target="_blank" rel="noreferrer" />
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Footer: elapsed time + copy button — always visible */}
      {!isUser && (hasContent || hasBlocks) && (
        <div className="flex items-center gap-2 mt-2">
          <ElapsedTime message={message} />
          {!isStreaming && hasContent && (
            <button
              onClick={() => void navigator.clipboard.writeText(message.content)}
              className="rounded-md border border-border bg-card p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              title="Copy"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const PIXEL_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function ElapsedTime({ message }: { message: ChatMessage }): React.ReactElement | null {
  const [now, setNow] = useState(Date.now())
  const [frame, setFrame] = useState(0)
  const isLive = message.state === 'streaming'

  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => {
      setNow(Date.now())
      setFrame((f) => (f + 1) % PIXEL_FRAMES.length)
    }, 80)
    return () => clearInterval(id)
  }, [isLive])

  if (message.role === 'user') return null

  const startTime = message.timestamp
  const endTime = message.completedAt ?? (isLive ? now : undefined)

  if (!endTime) return null

  const elapsed = (endTime - startTime) / 1000
  const formatted = elapsed < 10 ? `${elapsed.toFixed(1)}s` : `${Math.round(elapsed)}s`

  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 font-mono tabular-nums">
      {isLive && (
        <span className="text-[13px] leading-none">{PIXEL_FRAMES[frame]}</span>
      )}
      {formatted}
    </span>
  )
}

function CollapsibleBlockContainer({
  toolCount,
  messageCount,
  defaultExpanded,
  primaryToolIcon,
  children,
}: {
  toolCount: number
  messageCount: number
  defaultExpanded: boolean
  primaryToolIcon?: string
  children: React.ReactNode
}): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [userToggled, setUserToggled] = useState(false)

  // Auto-expand when streaming starts, auto-collapse when done
  const prevDefaultRef = React.useRef(defaultExpanded)
  if (defaultExpanded !== prevDefaultRef.current && !userToggled) {
    setExpanded(defaultExpanded)
  }
  prevDefaultRef.current = defaultExpanded

  const handleToggle = (): void => {
    setUserToggled(true)
    setExpanded(!expanded)
  }

  return (
    <div className="mb-2 overflow-hidden">
      {/* Summary header — always visible */}
      <ToolCallSummaryHeader
        toolCount={toolCount}
        messageCount={messageCount}
        expanded={expanded}
        onToggle={handleToggle}
        primaryToolIcon={primaryToolIcon}
      />
      {/* Collapsible content */}
      {expanded && (
        <div className="space-y-0.5 pb-1">
          {children}
        </div>
      )}
    </div>
  )
}

interface InterleavedBlock {
  type: 'thinking' | 'tool'
  data: ThinkingBlockType | ToolCall
  sortKey: number
  isLast: boolean
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function buildInterleavedBlocks(message: ChatMessage): InterleavedBlock[] {
  const blocks: InterleavedBlock[] = []

  // Add thinking blocks with their index as sort key
  if (message.thinkingBlocks) {
    for (const tb of message.thinkingBlocks) {
      blocks.push({ type: 'thinking', data: tb, sortKey: tb.index, isLast: false })
    }
  }

  // Add tool calls — use their array position as sort key (offset by 0.5 to interleave after thinking at same index)
  if (message.toolCalls) {
    for (let i = 0; i < message.toolCalls.length; i++) {
      blocks.push({ type: 'tool', data: message.toolCalls[i], sortKey: i + 0.5, isLast: false })
    }
  }

  // Sort by sortKey to interleave
  blocks.sort((a, b) => a.sortKey - b.sortKey)

  // Mark the last block
  if (blocks.length > 0) {
    blocks[blocks.length - 1].isLast = true
  }

  return blocks
}
