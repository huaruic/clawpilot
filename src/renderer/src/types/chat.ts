/**
 * Chat domain types — single source of truth for all chat-related data structures.
 *
 * Design principles:
 * - Discriminated unions over optional fields where possible
 * - Explicit state enums over boolean combos
 * - Types flow: Gateway wire → NormalizedEvent → Store types → UI props
 */

// ─── Message State ──────────────────────────────────────────────

export type MessageState = 'sending' | 'streaming' | 'done' | 'error'

export type ToolCallStatus = 'running' | 'done' | 'error'

// ─── Tool Call ──────────────────────────────────────────────────

export interface ToolCall {
  id: string
  name: string
  displayName: string
  args?: string
  argsRaw?: unknown
  status: ToolCallStatus
  output?: string
  meta?: string
  startedAt: number
  completedAt?: number
}

// ─── Thinking ───────────────────────────────────────────────────

export interface ThinkingBlock {
  content: string
  /** Position index for interleaving with tool calls in the UI */
  index: number
}

// ─── Attachments ────────────────────────────────────────────────

export interface AttachedFile {
  fileName: string
  mimeType: string
  fileSize: number
  /** data URL for image preview, null for non-image files */
  preview: string | null
  /** Local file path before upload (renderer-only) */
  localPath?: string
}

/** Base64-encoded attachment ready for Gateway RPC */
export interface AttachmentPayload {
  content: string
  mimeType: string
  fileName: string
}

// ─── Chat Message ───────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
  thinkingBlocks?: ThinkingBlock[]
  attachments?: AttachedFile[]
  state: MessageState
  timestamp: number
  completedAt?: number
  /** Model that generated this response (assistant only) */
  model?: string
  /** Which agent produced this message */
  agentId?: string
}

// ─── Session ────────────────────────────────────────────────────

export interface SessionSummary {
  key: string
  title: string
  preview: string
  updatedAt?: number
  agentId?: string
}

// ─── Draft ──────────────────────────────────────────────────────

export interface DraftState {
  text: string
  attachments?: AttachedFile[]
}

// ─── Chat Events (renderer ↔ main IPC) ─────────────────────────

/**
 * Normalized chat event flowing from main process to renderer.
 * Main process normalizes the Gateway's raw wire format into this shape.
 */
export type ChatEventState =
  | 'delta'
  | 'final'
  | 'aborted'
  | 'error'
  | 'tool_start'
  | 'tool_update'
  | 'tool_result'
  | 'thinking'

export interface ChatEvent {
  runId: string
  sessionKey: string
  seq: number
  state: ChatEventState
  message?: unknown
  errorMessage?: string
  thinkingText?: string
  thinkingDelta?: string
  toolCallId?: string
  toolName?: string
  toolArgs?: unknown
  toolMeta?: string
  toolIsError?: boolean
  toolResult?: unknown
}

// ─── Session time grouping ──────────────────────────────────────

export interface SessionGroup {
  label: string
  items: SessionSummary[]
}

export interface GroupedSessions {
  groups: SessionGroup[]
}

// ─── Agent ──────────────────────────────────────────────────────

export interface AgentSummary {
  id: string
  name?: string
  description?: string
  isDefault?: boolean
}
