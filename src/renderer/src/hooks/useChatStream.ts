import { useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useRuntimeStore } from '../stores/runtimeStore'
import type { ChatEvent } from '../api/ipc'

// Subscribe to chat chunks from main process and apply to store
export function useChatStreamSubscription(): void {
  const { applyChunk } = useChatStore()

  useEffect(() => {
    const unsub = window.clawpilot.chat.onChunk((chunk: ChatEvent) => {
      applyChunk(chunk)
    })
    return unsub
  }, [applyChunk])
}

export function useSendMessage(sessionKey: string): (text: string) => Promise<void> {
  const { addUserMessage } = useChatStore()
  const { snapshot } = useRuntimeStore()

  return async (text: string) => {
    if (snapshot.status !== 'RUNNING') return
    addUserMessage(sessionKey, text)
    await window.clawpilot.chat.send({ sessionKey, message: text })
  }
}
