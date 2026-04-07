/**
 * Chat stream hooks — subscribe to events and send messages.
 *
 * - useChatStreamSubscription: global chunk listener (mount once at app root)
 * - useSendMessage: send text + optional attachments, with safety timeout
 * - useAbortRun: cancel an in-flight agent run
 */

import { useEffect, useCallback } from 'react'
import { useChatStore, startSafetyTimeout } from '../stores/chat'
import { useRuntimeStore } from '../stores/runtimeStore'
import { sendMessage, abortRun, subscribeToChunks } from '../services/chatService'
import type { ChatEvent, AttachedFile, AttachmentPayload } from '../types'

// ─── Global chunk subscription ─────────────────────────────────

export function useChatStreamSubscription(): void {
  const applyChunk = useChatStore((s) => s.applyChunk)

  useEffect(() => {
    return subscribeToChunks((chunk: ChatEvent) => {
      applyChunk(chunk)
    })
  }, [applyChunk])
}

// ─── Send message ──────────────────────────────────────────────

interface SendMessageOptions {
  /** Files shown in the message bubble (for display) */
  attachments?: AttachedFile[]
  /** Pre-loaded base64 payloads ready for Gateway. Caller should use readFileAsBase64 to prepare these. */
  payloads?: AttachmentPayload[]
}

export function useSendMessage(sessionKey: string) {
  const addUserMessage = useChatStore((s) => s.addUserMessage)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const setActiveRun = useChatStore((s) => s.setActiveRun)
  const markRunError = useChatStore((s) => s.markRunError)
  const status = useRuntimeStore((s) => s.snapshot.status)

  return useCallback(
    async (text: string, options?: SendMessageOptions) => {
      if (status !== 'RUNNING') return

      // Optimistic: show user message immediately
      addUserMessage(sessionKey, text, options?.attachments)

      const attachmentPayloads = options?.payloads

      try {
        const result = await sendMessage({
          sessionKey,
          message: text,
          attachments: attachmentPayloads?.length ? attachmentPayloads : undefined,
        })

        if (result.runId) {
          setActiveRun(sessionKey, result.runId)
          // Safety timeout: mark error if no events arrive within 60s
          const cancelTimeout = startSafetyTimeout(sessionKey, result.runId)
          // Clean up timeout when streaming ends (via store subscription)
          const unsub = useChatStore.subscribe((state) => {
            if (!state.streaming[sessionKey]) {
              cancelTimeout()
              unsub()
            }
          })
        }
      } catch (err) {
        setStreaming(sessionKey, false)
        // Create a synthetic runId for error display
        const errorRunId = `error-${Date.now()}`
        markRunError(sessionKey, errorRunId, String(err) || 'Failed to send message')
      }
    },
    [sessionKey, status, addUserMessage, setStreaming, setActiveRun, markRunError],
  )
}

// ─── Abort run ─────────────────────────────────────────────────

export function useAbortRun(sessionKey: string) {
  const activeRuns = useChatStore((s) => s.activeRuns)
  const runId = activeRuns[sessionKey]

  return useCallback(async () => {
    if (!runId) return
    await abortRun(sessionKey, runId)
  }, [sessionKey, runId])
}
