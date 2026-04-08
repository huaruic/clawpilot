import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Plus, Paperclip, Globe, Mic, ChevronDown, ArrowUp,
  AlertTriangle, Loader2, Check,
  Code2, FileText, Zap, Globe2,
} from 'lucide-react'
import { CatMascot } from '../components/chat/CatMascot'
import { MessageBubble } from '../components/chat/MessageBubble'
import { ThinkingIndicator } from '../components/chat/ThinkingIndicator'
import { useChatStreamSubscription, useAbortRun } from '../hooks/useChatStream'
import { useChatStore, startSafetyTimeout } from '../stores/chat'
import { loadHistory, sendMessage as sendMessageRpc, resetSession } from '../services/chatService'
import type { ChatMessage } from '../types'
import { useRuntimeStore } from '../stores/runtimeStore'
import { useProviderStore } from '../stores/providerStore'
import { useI18n } from '../i18n/I18nProvider'
import type { Page } from '../components/layout/AppSidebar'
import type { ProviderAccount } from '../../../shared/providers/types'

/* ── Turn grouping ── */

interface Turn {
  user?: ChatMessage
  assistant?: ChatMessage
}

function groupIntoTurns(messages: ChatMessage[]): Turn[] {
  const turns: Turn[] = []
  for (const msg of messages) {
    if (msg.role === 'user') {
      turns.push({ user: msg })
    } else if (msg.role === 'assistant') {
      if (turns.length === 0 || turns[turns.length - 1].assistant) {
        // No preceding user message or previous turn already has an assistant message
        turns.push({ assistant: msg })
      } else {
        turns[turns.length - 1].assistant = msg
      }
    }
  }
  return turns
}

/* ── Segment messages by system dividers ── */

type Segment = { type: 'turns'; turns: Turn[] } | { type: 'system'; message: ChatMessage }

function segmentMessages(messages: ChatMessage[]): Segment[] {
  const segments: Segment[] = []
  let buffer: ChatMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'system') {
      if (buffer.length) segments.push({ type: 'turns', turns: groupIntoTurns(buffer) })
      buffer = []
      segments.push({ type: 'system', message: msg })
    } else {
      buffer.push(msg)
    }
  }
  if (buffer.length) segments.push({ type: 'turns', turns: groupIntoTurns(buffer) })
  return segments
}

/* ── Slash commands ── */

const SLASH_COMMANDS = [
  { command: '/new', descKey: 'app.chat.cmdNewDesc' as const },
  { command: '/clear', descKey: 'app.chat.cmdClearDesc' as const },
]

/* ── greeting helper ── */

function useGreeting(): string {
  const { t } = useI18n()
  const hour = new Date().getHours()
  if (hour < 12) return t('app.chat.greetingMorning')
  if (hour < 18) return t('app.chat.greetingAfternoon')
  return t('app.chat.greetingEvening')
}

/* ── quick start cards config ── */

const QUICK_START_ICONS = [Code2, FileText, Zap, Globe2] as const
const QUICK_START_KEYS = ['Script', 'Analyze', 'Brainstorm', 'Research'] as const

/* ── helpers ── */

function shouldShowThinkingIndicator(
  messages: ReturnType<typeof useChatStore.getState>['messages'][string]
): boolean {
  if (!messages || messages.length === 0) return true
  const last = messages[messages.length - 1]
  // Last message is user → still waiting for assistant to start
  if (last.role === 'user') return true
  // Last message is assistant with no content, no running tools, and no thinking → thinking
  if (last.role === 'assistant') {
    const hasContent = last.content.trim().length > 0
    const hasToolCalls = (last.toolCalls?.length ?? 0) > 0
    const hasThinking = (last.thinkingBlocks?.length ?? 0) > 0
    if (!hasContent && !hasToolCalls && !hasThinking) return true
  }
  return false
}

/* ── Model Selector ── */

function getModelDisplayName(account: ProviderAccount): string {
  if (account.model) return account.model
  return account.label
}

function ModelSelector({
  accounts,
  defaultAccountId,
  onSelect,
}: {
  accounts: ProviderAccount[]
  defaultAccountId: string | null
  onSelect: (accountId: string) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const current = accounts.find((a) => a.id === defaultAccountId)
  const displayName = current ? getModelDisplayName(current) : 'No Provider'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-active-scale flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/[0.03]"
      >
        <span>{displayName}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && accounts.length > 0 && (
        <div className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
          <div className="py-1">
            {accounts.map((account) => {
              const isActive = account.id === defaultAccountId
              return (
                <button
                  key={account.id}
                  onClick={() => {
                    onSelect(account.id)
                    setOpen(false)
                  }}
                  className="btn-active-scale flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] hover:bg-foreground/[0.05] transition-colors"
                >
                  <span className="flex-1 truncate text-foreground">{getModelDisplayName(account)}</span>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Input Bar (new design) ── */

function InputBar({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  accounts,
  defaultAccountId,
  onSelectModel,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder: string
  accounts: ProviderAccount[]
  defaultAccountId: string | null
  onSelectModel: (accountId: string) => void
}): React.ReactElement {
  const [isComposing, setIsComposing] = useState(false)
  const { t: tCmd } = useI18n()
  const filteredCommands = value.startsWith('/')
    ? SLASH_COMMANDS.filter((cmd) => cmd.command.startsWith(value) && value.length <= 6)
    : []

  return (
    <div className="relative group">
      {/* Peeking Cat */}
      <div className="absolute -top-10 left-10 pointer-events-none z-10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500">
        <CatMascot mode="peeking" />
      </div>

      <div className="relative rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_24px_-4px_rgba(0,0,0,0.1)] focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all duration-300">
      {/* Slash command popup */}
      {filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => {
                onChange(cmd.command)
              }}
              className="btn-active-scale flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-foreground/[0.05] transition-colors"
            >
              <span className="text-sm font-mono font-medium text-foreground">{cmd.command}</span>
              <span className="text-xs text-muted-foreground">{tCmd(cmd.descKey)}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={(e) => {
          if (isComposing) return
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!disabled) onSend()
          }
        }}
        placeholder={placeholder}
        className="w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/50 resize-none outline-none min-h-[44px] max-h-[160px] px-5 pt-4 pb-1"
      />
      <div className="flex items-center justify-between px-3 pb-3">
        <div className="flex items-center gap-0.5">
          <button className="btn-active-scale clickable p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/[0.03]">
            <Plus className="h-[18px] w-[18px]" />
          </button>
          <button className="btn-active-scale clickable p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/[0.03]">
            <Paperclip className="h-[18px] w-[18px]" />
          </button>
          <button className="btn-active-scale clickable p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/[0.03]">
            <Globe className="h-[18px] w-[18px]" />
          </button>
          <button className="btn-active-scale clickable p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/[0.03]">
            <Mic className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector
            accounts={accounts}
            defaultAccountId={defaultAccountId}
            onSelect={onSelectModel}
          />
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className={`btn-active-scale ${`clickable flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-40 shadow-sm border border-black/10 dark:border-white/5 ${
              value.trim()
                ? 'bg-foreground text-card hover:bg-foreground/90'
                : 'bg-muted text-muted-foreground'
            }`}`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}

/* ── Quick Start Grid ── */
function QuickStartGrid({ onSelect }: { onSelect: (prompt: string) => void }): React.ReactElement {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {QUICK_START_KEYS.map((key, i) => {
        const Icon = QUICK_START_ICONS[i]
        const title = t(`app.chat.quick${key}Title`)
        const desc = t(`app.chat.quick${key}Desc`)
        const prompt = t(`app.chat.quick${key}Prompt`)

        return (
          <button
            key={key}
            onClick={() => onSelect(prompt)}
            className="btn-active-scale flex items-start gap-3 p-4 bg-card/70 hover:bg-card/90 border border-border/30 rounded-xl text-left transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
              <Icon className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-foreground leading-tight">{title}</div>
              <div className="text-[13px] text-muted-foreground mt-1 leading-snug">{desc}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ── Welcome View (no messages) ── */

function WelcomeView({
  input,
  setInput,
  onSend,
  accounts,
  defaultAccountId,
  onSelectModel,
  isStreaming,
}: {
  input: string
  setInput: (v: string) => void
  onSend: () => void
  accounts: ProviderAccount[]
  defaultAccountId: string | null
  onSelectModel: (accountId: string) => void
  isStreaming: boolean
}): React.ReactElement {
  const greeting = useGreeting()
  const { t } = useI18n()

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="flex w-full max-w-[640px] flex-col items-center">
        <div className="mb-6">
          <CatMascot mode="lounging" />
        </div>
        <h1 className="mb-8 text-[48px] font-semibold leading-tight tracking-tight text-foreground">
          {greeting}
        </h1>

        <div className="mb-8 w-full">
          <InputBar
            value={input}
            onChange={setInput}
            onSend={onSend}
            disabled={isStreaming}
            placeholder={t('app.chat.welcomePlaceholder')}
            accounts={accounts}
            defaultAccountId={defaultAccountId}
            onSelectModel={onSelectModel}
          />
        </div>

        <div className="w-full">
          <div className="mb-3 px-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t('app.chat.quickStart')}
            </span>
          </div>
          <QuickStartGrid onSelect={(prompt) => setInput(prompt)} />
          <p className="mt-4 text-center text-[11px] text-muted-foreground/50">
            {t('app.chat.slashHint')}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Chat View (has messages) ── */

function ChatView({
  messages,
  input,
  setInput,
  onSend,
  accounts,
  defaultAccountId,
  onSelectModel,
  isStreaming,
  pendingScrollRef,
}: {
  messages: ReturnType<typeof useChatStore.getState>['messages'][string]
  input: string
  setInput: (v: string) => void
  onSend: () => void
  accounts: ProviderAccount[]
  defaultAccountId: string | null
  onSelectModel: (accountId: string) => void
  isStreaming: boolean
  pendingScrollRef: React.MutableRefObject<boolean>
}): React.ReactElement {
  const { t } = useI18n()
  const activeMessages = messages ?? []
  const currentTurnRef = useRef<HTMLDivElement | null>(null)
  const prevTurnCountRef = useRef(0)

  const segments = segmentMessages(activeMessages)
  // Collect all turns across segments for scroll tracking
  const allTurns = segments.flatMap((s) => (s.type === 'turns' ? s.turns : []))

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const userScrolledUpRef = useRef(false)

  // Track whether user has scrolled away from bottom
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    function handleScroll(): void {
      if (!el) return
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
      userScrolledUpRef.current = !atBottom
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to bottom when a new turn appears after user sends
  useEffect(() => {
    if (pendingScrollRef.current && allTurns.length > prevTurnCountRef.current) {
      pendingScrollRef.current = false
      userScrolledUpRef.current = false
      requestAnimationFrame(() => {
        const el = scrollContainerRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    }
    prevTurnCountRef.current = allTurns.length
  }, [allTurns.length, pendingScrollRef])

  // Auto-scroll to bottom during streaming unless user scrolled up
  useEffect(() => {
    if (!isStreaming || userScrolledUpRef.current) return
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [isStreaming, activeMessages])

  // Find the very last turn across all segments for thinking indicator
  const lastTurn = allTurns.length > 0 ? allTurns[allTurns.length - 1] : undefined

  return (
    <div className="flex h-full flex-col">
      {/* Messages — scroll container */}
      <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] space-y-4 px-6 py-6">
            {segments.map((segment) => {
              if (segment.type === 'system') {
                return (
                  <div key={segment.message.id} className="flex items-center gap-3 py-4">
                    <div className="flex-1 border-t border-border/50" />
                    <span className="text-xs text-muted-foreground/60">{segment.message.content}</span>
                    <div className="flex-1 border-t border-border/50" />
                  </div>
                )
              }
              return segment.turns.map((turn, index) => {
                const isLastTurn = turn === lastTurn
                const turnKey = turn.user?.id ?? turn.assistant?.id ?? `turn-${index}`
                return (
                  <div
                    key={turnKey}
                    ref={isLastTurn ? currentTurnRef : undefined}
                    className="space-y-4"
                  >
                    {/* User message */}
                    {turn.user && (
                      <div>
                        <MessageBubble message={turn.user} />
                      </div>
                    )}
                    {/* Assistant message */}
                    {turn.assistant && (
                      <div>
                        <MessageBubble message={turn.assistant} />
                      </div>
                    )}
                    {/* Thinking indicator when waiting for first response in last turn */}
                    {isLastTurn && isStreaming && turn.user && !turn.assistant && (
                      <ThinkingIndicator startTime={turn.user.timestamp} />
                    )}
                    {isLastTurn && isStreaming && turn.assistant && shouldShowThinkingIndicator(activeMessages) && (
                      <ThinkingIndicator startTime={turn.assistant.timestamp} />
                    )}
                  </div>
                )
              })
            })}
        </div>
      </div>

      {/* Bottom input */}
      <div className="shrink-0 px-6 pb-4">
        <div className="mx-auto max-w-[680px]">
          <InputBar
            value={input}
            onChange={setInput}
            onSend={onSend}
            disabled={isStreaming}
            placeholder={t('app.chat.continuePlaceholder')}
            accounts={accounts}
            defaultAccountId={defaultAccountId}
            onSelectModel={onSelectModel}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Setup Banner ── */

function SetupBanner({ onGoToProviders }: { onGoToProviders: () => void }): React.ReactElement {
  const { t } = useI18n()
  return (
    <div className="mx-4 mt-3 flex items-center justify-between gap-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-medium text-foreground">{t('app.chat.setupBannerTitle')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('app.chat.setupBannerDesc')}</p>
        </div>
      </div>
      <button
        onClick={onGoToProviders}
        className="btn-active-scale shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t('app.chat.setupBannerAction')}
      </button>
    </div>
  )
}

/* ── Starting Banner ── */

function StartingBanner(): React.ReactElement {
  const { t } = useI18n()
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">{t('app.chat.startingBannerTitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('app.chat.startingBannerDesc')}</p>
      </div>
    </div>
  )
}

/* ── Main ChatPage ── */

export function ChatPage({ onNavigate }: { onNavigate: (page: Page) => void }): React.ReactElement {
  const { t } = useI18n()
  useChatStreamSubscription()

  const { snapshot } = useRuntimeStore()
  const { accounts, defaultAccountId, init: initProviders, setDefault: setDefaultProvider } = useProviderStore()
  const { activeSession, hydrateSession, messages, streaming, bumpSessionList, newSession, clearSession } = useChatStore()

  const [historyLoading, setHistoryLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const pendingScrollRef = useRef(false)

  const abortRun = useAbortRun(activeSession)
  const setStreamingState = useChatStore((s) => s.setStreaming)
  const setActiveRun = useChatStore((s) => s.setActiveRun)
  const addUserMessage = useChatStore((s) => s.addUserMessage)
  const activeMessages = messages[activeSession] ?? []
  const isStreaming = streaming[activeSession] ?? false

  // Load provider accounts
  useEffect(() => { void initProviders() }, [initProviders])

  const enabledAccounts = accounts.filter((a) => a.enabled)

  const handleSelectModel = useCallback(async (accountId: string) => {
    await setDefaultProvider(accountId)
  }, [setDefaultProvider])

  // Load history when active session changes or runtime starts.
  // IMPORTANT: `messages` must NOT be in the dep array — otherwise every chunk/send
  // re-triggers a history fetch that overwrites the live streaming state, causing
  // flickering and loss of real-time data.
  useEffect(() => {
    if (snapshot.status !== 'RUNNING' || !snapshot.wsConnected || !activeSession) return
    // Skip reload if we already have messages for this session (e.g. mid-stream)
    if ((messages[activeSession]?.length ?? 0) > 0) return
    let cancelled = false
    setHistoryLoading(true)

    loadHistory(activeSession, 100)
      .then((normalized) => {
        if (cancelled) return
        hydrateSession(activeSession, normalized)
      })
      .finally(() => { if (!cancelled) setHistoryLoading(false) })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, snapshot.status, snapshot.startedAt, snapshot.wsConnected])

  const needsSetup = !snapshot.setup.hasProvider || !snapshot.setup.hasDefaultModel
  const isStarting = !needsSetup && (snapshot.status === 'STARTING' || snapshot.status === 'UPDATING')
  const isReady = snapshot.status === 'RUNNING' && !needsSetup

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text || isStreaming) return

    // ── Slash command interception ──
    if (text === '/new') {
      setInput('')
      newSession('default')
      return
    }
    if (text === '/clear') {
      setInput('')
      setSendError(null)
      clearSession(activeSession)
      resetSession(activeSession).catch((err) => {
        setSendError(err instanceof Error ? err.message : String(err))
      })
      return
    }

    setSendError(null)
    setInput('')
    pendingScrollRef.current = true

    // If current session has no messages, create a new session for this conversation
    const currentMessages = useChatStore.getState().messages[activeSession] ?? []
    let targetSession = activeSession
    if (currentMessages.length === 0) {
      targetSession = newSession('default')
    }

    // Optimistic: show user message + session in sidebar immediately
    addUserMessage(targetSession, text)
    bumpSessionList()

    try {
      const result = await sendMessageRpc({ sessionKey: targetSession, message: text })
      if (result.runId) {
        setActiveRun(targetSession, result.runId)
        const cancelTimeout = startSafetyTimeout(targetSession, result.runId)
        const unsub = useChatStore.subscribe((state) => {
          if (!state.streaming[targetSession]) {
            cancelTimeout()
            unsub()
          }
        })
      }
      // Bump again after RPC so Gateway's response (with proper updatedAt) replaces the optimistic entry
      bumpSessionList()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err))
      setStreamingState(targetSession, false)
    }
  }

  // messages[activeSession] === undefined means never loaded; [] means hydrated (new or empty)
  const messagesNotLoaded = messages[activeSession] === undefined
  // Show chat view when: there are messages, OR history is being / needs to be loaded
  const hasMessages = activeMessages.length > 0 || (isReady && messagesNotLoaded)

  return (
    <div className="flex h-full">
      {/* Main content — full width, no session sidebar */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Setup / starting banners */}
        {needsSetup && <SetupBanner onGoToProviders={() => onNavigate('providers')} />}
        {isStarting && <StartingBanner />}

        {/* Send error banner */}
        {sendError && (
          <div className="mx-4 mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {sendError}
          </div>
        )}

        {/* Content area */}
        {isReady && historyLoading && messagesNotLoaded ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-muted-foreground">{t('app.chat.loadingHistory')}</p>
          </div>
        ) : !isReady || !hasMessages ? (
          <WelcomeView
            input={input}
            setInput={setInput}
            onSend={() => void handleSend()}
            accounts={enabledAccounts}
            defaultAccountId={defaultAccountId}
            onSelectModel={(id) => void handleSelectModel(id)}
            isStreaming={isStreaming || !isReady}
          />
        ) : (
          <ChatView
            messages={activeMessages}
            input={input}
            setInput={setInput}
            onSend={() => void handleSend()}
            accounts={enabledAccounts}
            defaultAccountId={defaultAccountId}
            onSelectModel={(id) => void handleSelectModel(id)}
            isStreaming={isStreaming}
            pendingScrollRef={pendingScrollRef}
          />
        )}
      </section>
    </div>
  )
}

