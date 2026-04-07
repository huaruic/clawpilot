/**
 * Re-export barrel — redirects all imports to the new modular chat store.
 *
 * Existing files import from '../stores/chatStore'. Rather than updating every
 * consumer, this file re-exports the canonical types and store from stores/chat/.
 * New code should import directly from '../stores/chat' or '../types'.
 */

export { useChatStore, DEFAULT_SESSION } from './chat'

export type {
  ChatMessage,
  ToolCall,
  ThinkingBlock,
  ChatEvent,
  DraftState,
  AttachedFile,
} from '../types'

export type { SessionSummary } from '../types'

export { normalizeHistory, normalizeSessions, groupSessions, buildSessionKey } from './chat/helpers'
