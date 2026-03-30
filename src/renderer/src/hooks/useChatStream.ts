import { useEffect } from 'react'
import { useChatStore, normalizeHistory } from '../stores/chatStore'
import { useRuntimeStore } from '../stores/runtimeStore'
import type { ChatEvent } from '../api/ipc'

const HISTORY_FALLBACK_MS = 4000
const HISTORY_POLL_INTERVAL = 5000

// Subscribe to chat chunks from main process and apply to store
export function useChatStreamSubscription(): void {
  const { applyChunk, applyHistory, activeSession, streaming, lastEventAt } = useChatStore()
  const { snapshot } = useRuntimeStore()

  useEffect(() => {
    const unsub = window.clawpilot.chat.onChunk((chunk: ChatEvent) => {
      applyChunk(chunk)
    })
    return unsub
  }, [applyChunk])

  useEffect(() => {
    if (snapshot.status !== 'RUNNING') return

    const intervalId = window.setInterval(() => {
      const isStreaming = streaming[activeSession]
      const lastEvent = lastEventAt[activeSession] ?? 0
      if (!isStreaming) return
      if (Date.now() - lastEvent < HISTORY_FALLBACK_MS) return

      window.clawpilot.chat.history({ sessionKey: activeSession, limit: 120 })
        .then((history) => {
          const normalized = normalizeHistory(activeSession, history)
          if (normalized.length > 0) {
            applyHistory(activeSession, normalized)
          }
        })
        .catch(() => undefined)
    }, HISTORY_POLL_INTERVAL)

    return () => window.clearInterval(intervalId)
  }, [activeSession, applyHistory, lastEventAt, snapshot.status, streaming])
}

export function useSendMessage(sessionKey: string): (text: string) => Promise<void> {
  const { addUserMessage, markMessageState } = useChatStore()
  const { snapshot } = useRuntimeStore()

  return async (text: string) => {
    if (snapshot.status !== 'RUNNING') return
    const messageId = addUserMessage(sessionKey, text)
    try {
      await window.clawpilot.chat.send({ sessionKey, message: text })
      markMessageState(sessionKey, messageId, 'done')
    } catch (error) {
      markMessageState(sessionKey, messageId, 'error')
      throw error
    }
  }
}
