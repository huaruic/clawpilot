import { useRef, useCallback, useEffect, useState } from 'react'

/**
 * useStickyScroll — sticky-to-bottom scroll for chat UIs.
 *
 * Behavior:
 * - When the user is near the bottom (within THRESHOLD px), auto-scroll
 *   follows new content as it streams in (via ResizeObserver on the content).
 * - When the user scrolls up past the threshold, auto-follow disengages.
 * - `scrollToBottom()` re-engages sticky mode (call on send).
 * - `isAtBottom` can be used to show a "scroll to bottom" button.
 *
 * This avoids the problems of useEffect-based scroll:
 * - No fighting between multiple effects
 * - No time-based locks
 * - Works naturally with streaming content of any shape
 */

const THRESHOLD = 120 // px from bottom to consider "at bottom"

interface UseStickyScrollReturn {
  /** Ref to attach to the scroll container (the overflow-y:auto div) */
  scrollRef: React.RefObject<HTMLDivElement | null>
  /** Ref to attach to the inner content wrapper (direct child of scroll container) */
  contentRef: React.RefObject<HTMLDivElement | null>
  /** Whether the user is currently at/near the bottom */
  isAtBottom: boolean
  /** Force scroll to bottom and re-engage sticky mode */
  scrollToBottom: () => void
}

export function useStickyScroll(): UseStickyScrollReturn {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Internal sticky state (ref for sync access in callbacks)
  const stickyRef = useRef(true)

  const checkIfAtBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    return distance <= THRESHOLD
  }, [])

  const doScrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  // Public: force scroll to bottom (e.g. on send message)
  const scrollToBottom = useCallback(() => {
    stickyRef.current = true
    setIsAtBottom(true)
    // Use rAF to ensure DOM has updated with the new message
    requestAnimationFrame(() => {
      doScrollToBottom()
    })
  }, [doScrollToBottom])

  // Listen to scroll events on the container to detect user scroll-up
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let ticking = false
    const onScroll = (): void => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const atBottom = checkIfAtBottom()
        stickyRef.current = atBottom
        setIsAtBottom(atBottom)
        ticking = false
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [checkIfAtBottom])

  // Use ResizeObserver on the content to auto-scroll when content grows
  // This is the key: instead of reacting to state changes (which causes
  // effect ordering issues), we react to the actual DOM size change.
  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const observer = new ResizeObserver(() => {
      if (stickyRef.current) {
        doScrollToBottom()
      }
    })

    observer.observe(content)
    return () => observer.disconnect()
  }, [doScrollToBottom])

  return { scrollRef, contentRef, isAtBottom, scrollToBottom }
}
