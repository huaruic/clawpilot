import { describe, it, expect } from 'vitest'
import { processChunk } from '../../renderer/src/stores/chat/chunkProcessor'
import type { ChatMessage, ChatEvent } from '../../renderer/src/types'

function makeEvent(overrides: Partial<ChatEvent>): ChatEvent {
  return {
    runId: 'run-1',
    sessionKey: 'sess-1',
    seq: 1,
    state: 'delta',
    ...overrides,
  }
}

function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'run-1',
    role: 'assistant',
    content: 'partial',
    state: 'streaming',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('processChunk', () => {
  // ── delta ───────────────────────────────────────────────────

  describe('delta', () => {
    it('creates new message when none exists', () => {
      const { messages, isTerminal } = processChunk([], makeEvent({
        state: 'delta',
        message: 'hello',
      }))
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('hello')
      expect(messages[0].state).toBe('streaming')
      expect(isTerminal).toBe(false)
    })

    it('updates existing message content', () => {
      const existing = [makeMsg({ content: 'old' })]
      const { messages } = processChunk(existing, makeEvent({
        state: 'delta',
        message: 'new content',
      }))
      expect(messages[0].content).toBe('new content')
      expect(messages[0].state).toBe('streaming')
    })
  })

  // ── final ───────────────────────────────────────────────────

  describe('final', () => {
    it('marks message as done with completedAt', () => {
      const existing = [makeMsg()]
      const { messages, isTerminal } = processChunk(existing, makeEvent({
        state: 'final',
        message: 'final content',
      }))
      expect(messages[0].state).toBe('done')
      expect(messages[0].content).toBe('final content')
      expect(messages[0].completedAt).toBeTypeOf('number')
      expect(isTerminal).toBe(true)
    })

    it('marks running tool calls as done', () => {
      const existing = [makeMsg({
        toolCalls: [{
          id: 'tc-1', name: 'exec', displayName: 'Bash',
          status: 'running', startedAt: Date.now(),
        }],
      })]
      const { messages } = processChunk(existing, makeEvent({ state: 'final' }))
      expect(messages[0].toolCalls![0].status).toBe('done')
    })

    it('creates new done message when no existing', () => {
      const { messages } = processChunk([], makeEvent({
        state: 'final',
        runId: 'new-run',
        message: 'done',
      }))
      expect(messages).toHaveLength(1)
      expect(messages[0].state).toBe('done')
    })
  })

  // ── error ───────────────────────────────────────────────────

  describe('error', () => {
    it('marks message as error state', () => {
      const existing = [makeMsg()]
      const { messages, isTerminal } = processChunk(existing, makeEvent({
        state: 'error',
        errorMessage: 'rate limit',
      }))
      expect(messages[0].state).toBe('error')
      expect(isTerminal).toBe(true)
    })

    it('preserves partial content', () => {
      const existing = [makeMsg({ content: 'partial response' })]
      const { messages } = processChunk(existing, makeEvent({
        state: 'error',
        errorMessage: 'timeout',
      }))
      expect(messages[0].content).toBe('partial response')
    })

    it('creates error message when no existing', () => {
      const { messages } = processChunk([], makeEvent({
        state: 'error',
        runId: 'err-run',
        errorMessage: 'failed',
      }))
      expect(messages).toHaveLength(1)
      expect(messages[0].state).toBe('error')
      expect(messages[0].content).toBe('failed')
    })
  })

  // ── aborted ─────────────────────────────────────────────────

  describe('aborted', () => {
    it('is terminal', () => {
      const { isTerminal } = processChunk([makeMsg()], makeEvent({ state: 'aborted' }))
      expect(isTerminal).toBe(true)
    })
  })

  // ── tool_start ──────────────────────────────────────────────

  describe('tool_start', () => {
    it('appends tool call to message', () => {
      const existing = [makeMsg()]
      const { messages } = processChunk(existing, makeEvent({
        state: 'tool_start',
        toolCallId: 'tc-1',
        toolName: 'exec',
        toolArgs: { command: 'ls' },
      }))
      expect(messages[0].toolCalls).toHaveLength(1)
      expect(messages[0].toolCalls![0].name).toBe('exec')
      expect(messages[0].toolCalls![0].displayName).toBe('Bash')
      expect(messages[0].toolCalls![0].status).toBe('running')
    })

    it('creates message if none exists', () => {
      const { messages } = processChunk([], makeEvent({
        state: 'tool_start',
        toolCallId: 'tc-1',
        toolName: 'read',
      }))
      expect(messages).toHaveLength(1)
      expect(messages[0].toolCalls).toHaveLength(1)
    })
  })

  // ── tool_result ─────────────────────────────────────────────

  describe('tool_result', () => {
    it('updates matching tool call with output', () => {
      const existing = [makeMsg({
        toolCalls: [{
          id: 'tc-1', name: 'exec', displayName: 'Bash',
          status: 'running', startedAt: Date.now(),
        }],
      })]
      const { messages } = processChunk(existing, makeEvent({
        state: 'tool_result',
        toolCallId: 'tc-1',
        toolResult: 'output text',
        toolIsError: false,
      }))
      expect(messages[0].toolCalls![0].status).toBe('done')
      expect(messages[0].toolCalls![0].output).toBe('output text')
    })

    it('downgrades read error on ENOENT', () => {
      const existing = [makeMsg({
        toolCalls: [{
          id: 'tc-1', name: 'read', displayName: 'Read File',
          status: 'running', startedAt: Date.now(),
        }],
      })]
      const { messages } = processChunk(existing, makeEvent({
        state: 'tool_result',
        toolCallId: 'tc-1',
        toolResult: 'ENOENT: no such file or directory',
        toolIsError: true,
      }))
      // Downgraded from error to done for read + ENOENT
      expect(messages[0].toolCalls![0].status).toBe('done')
    })

    it('keeps error status for non-read tools', () => {
      const existing = [makeMsg({
        toolCalls: [{
          id: 'tc-1', name: 'exec', displayName: 'Bash',
          status: 'running', startedAt: Date.now(),
        }],
      })]
      const { messages } = processChunk(existing, makeEvent({
        state: 'tool_result',
        toolCallId: 'tc-1',
        toolResult: 'ENOENT: no such file or directory',
        toolIsError: true,
      }))
      expect(messages[0].toolCalls![0].status).toBe('error')
    })
  })

  // ── thinking ────────────────────────────────────────────────

  describe('thinking', () => {
    it('appends new thinking block', () => {
      const existing = [makeMsg()]
      const { messages } = processChunk(existing, {
        ...makeEvent({ state: 'thinking' }),
        thinkingText: 'Let me think...',
      })
      expect(messages[0].thinkingBlocks).toHaveLength(1)
      expect(messages[0].thinkingBlocks![0].content).toBe('Let me think...')
    })

    it('appends delta to last thinking block', () => {
      const existing = [makeMsg({
        thinkingBlocks: [{ content: 'start', index: 0 }],
      })]
      const { messages } = processChunk(existing, {
        ...makeEvent({ state: 'thinking' }),
        thinkingDelta: ' more',
      })
      expect(messages[0].thinkingBlocks).toHaveLength(1)
      expect(messages[0].thinkingBlocks![0].content).toBe('start more')
    })
  })

  // ── isTerminal ──────────────────────────────────────────────

  describe('isTerminal', () => {
    it('true for final/error/aborted', () => {
      for (const state of ['final', 'error', 'aborted'] as const) {
        const { isTerminal } = processChunk([makeMsg()], makeEvent({ state }))
        expect(isTerminal).toBe(true)
      }
    })

    it('false for delta/tool_start/tool_result/thinking', () => {
      for (const state of ['delta', 'tool_start', 'tool_result', 'thinking'] as const) {
        const chunk = state === 'tool_result'
          ? makeEvent({ state, toolCallId: 'tc-1' })
          : makeEvent({ state })
        const { isTerminal } = processChunk([makeMsg()], chunk)
        expect(isTerminal).toBe(false)
      }
    })
  })
})
