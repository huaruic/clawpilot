/**
 * Pure chunk processor — the event state machine for chat streaming.
 *
 * Takes current messages + a ChatEvent, returns updated messages array.
 * No side effects, no store access. This makes the state machine testable
 * and decoupled from the store implementation.
 */

import type { ChatMessage, ChatEvent, ToolCall, ThinkingBlock } from '../../types'
import { extractContent, extractToolResultText, resolveToolDisplayName, formatToolArgs } from './helpers'

export interface ChunkResult {
  messages: ChatMessage[]
  isTerminal: boolean
}

/**
 * Process a single streaming chunk against current messages.
 * Returns new messages array (immutable) and whether this was a terminal event.
 */
export function processChunk(current: ChatMessage[], chunk: ChatEvent): ChunkResult {
  const { runId, state, message } = chunk
  const content = extractContent(message)
  const msgs = [...current]
  const idx = msgs.findIndex((m) => m.id === runId)

  const ensureMsg = (): number => {
    if (idx >= 0) return idx
    msgs.push({
      id: runId,
      role: 'assistant',
      content: '',
      state: 'streaming',
      timestamp: Date.now(),
    })
    return msgs.length - 1
  }

  switch (state) {
    case 'delta': {
      const i = ensureMsg()
      msgs[i] = { ...msgs[i], content, state: 'streaming' }
      break
    }

    case 'final': {
      if (idx >= 0) {
        const toolCalls = msgs[idx].toolCalls?.map((tc) =>
          tc.status === 'running' ? { ...tc, status: 'done' as const, completedAt: Date.now() } : tc,
        )
        msgs[idx] = {
          ...msgs[idx],
          content: content || msgs[idx].content,
          state: 'done',
          toolCalls,
          completedAt: Date.now(),
        }
      } else {
        const now = Date.now()
        msgs.push({
          id: runId,
          role: 'assistant',
          content,
          state: 'done',
          timestamp: now,
          completedAt: now,
        })
      }
      break
    }

    case 'error':
    case 'aborted': {
      const now = Date.now()
      if (idx >= 0) {
        // Preserve partial content, mark tool calls as done
        const toolCalls = msgs[idx].toolCalls?.map((tc) =>
          tc.status === 'running' ? { ...tc, status: 'error' as const, completedAt: now } : tc,
        )
        msgs[idx] = {
          ...msgs[idx],
          state: 'error',
          content: msgs[idx].content || chunk.errorMessage || 'Error',
          toolCalls,
          completedAt: now,
        }
      } else {
        msgs.push({
          id: runId,
          role: 'assistant',
          content: chunk.errorMessage || 'Error',
          state: 'error',
          timestamp: now,
          completedAt: now,
        })
      }
      break
    }

    case 'tool_start': {
      const i = ensureMsg()
      const existing = msgs[i].toolCalls ?? []
      const toolCall: ToolCall = {
        id: chunk.toolCallId ?? `tc-${Date.now()}`,
        name: chunk.toolName ?? 'unknown',
        displayName: resolveToolDisplayName(chunk.toolName ?? ''),
        args: formatToolArgs(chunk.toolName ?? '', chunk.toolArgs),
        argsRaw: chunk.toolArgs,
        status: 'running',
        meta: undefined,
        startedAt: Date.now(),
      }
      msgs[i] = { ...msgs[i], state: 'streaming', toolCalls: [...existing, toolCall] }
      break
    }

    case 'tool_result': {
      if (idx >= 0) {
        const now = Date.now()
        const resultText = extractToolResultText(chunk.toolResult)
        const toolCalls = (msgs[idx].toolCalls ?? []).map((tc) => {
          if (tc.id !== chunk.toolCallId) return tc
          // Downgrade "error" to "done" for read operations on missing/empty files —
          // this is expected behavior (e.g. memory files not yet created), not a real error.
          let status: ToolCall['status'] = chunk.toolIsError ? 'error' : 'done'
          if (
            status === 'error' &&
            tc.name === 'read' &&
            /no such file|not found|ENOENT|is empty/i.test(resultText)
          ) {
            status = 'done'
          }
          return { ...tc, status, output: resultText, meta: chunk.toolMeta || tc.meta, completedAt: now }
        })
        msgs[idx] = { ...msgs[idx], toolCalls }
      }
      break
    }

    case 'tool_update': {
      // Reserved for partial tool results. No-op for now.
      break
    }

    case 'thinking': {
      const i = ensureMsg()
      const existing = msgs[i].thinkingBlocks ?? []
      const delta = (chunk as unknown as { thinkingDelta?: string }).thinkingDelta ?? ''
      const fullText = (chunk as unknown as { thinkingText?: string }).thinkingText ?? ''

      let updatedBlocks: ThinkingBlock[]
      if (existing.length > 0 && delta) {
        const last = existing[existing.length - 1]
        updatedBlocks = [...existing.slice(0, -1), { ...last, content: last.content + delta }]
      } else {
        const seqIndex = (msgs[i].toolCalls?.length ?? 0) + existing.length
        updatedBlocks = [...existing, { content: fullText || delta, index: seqIndex }]
      }
      msgs[i] = { ...msgs[i], state: 'streaming', thinkingBlocks: updatedBlocks }
      break
    }
  }

  const isTerminal = state === 'final' || state === 'error' || state === 'aborted'
  return { messages: msgs, isTerminal }
}
