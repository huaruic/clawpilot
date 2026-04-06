import React, { useState, useEffect } from 'react'

/**
 * Pixel-style spinning loading indicator with elapsed time.
 * Matches Claude Code's `.: 2.6s` style.
 */

const PIXEL_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function ThinkingIndicator({ startTime }: { startTime?: number }): React.ReactElement {
  const [frame, setFrame] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const start = startTime ?? Date.now()

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % PIXEL_FRAMES.length)
      setElapsed((Date.now() - start) / 1000)
    }, 80)
    return () => clearInterval(id)
  }, [start])

  const timeStr = elapsed < 10 ? `${elapsed.toFixed(1)}s` : `${Math.round(elapsed)}s`

  return (
    <div className="flex items-center gap-2.5 py-2 px-1">
      <span className="text-[14px] font-mono text-muted-foreground leading-none">
        {PIXEL_FRAMES[frame]}
      </span>
      <span className="text-[12px] font-mono text-muted-foreground/60 tabular-nums">
        {timeStr}
      </span>
    </div>
  )
}
