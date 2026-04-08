import React, { useState, useEffect } from 'react'
import { CatMascot } from './CatMascot'

export function ThinkingIndicator({ startTime }: { startTime?: number }): React.ReactElement {
  const [elapsed, setElapsed] = useState(0)
  const start = startTime ?? Date.now()

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((Date.now() - start) / 1000)
    }, 100)
    return () => clearInterval(id)
  }, [start])

  const timeStr = elapsed < 10 ? `${elapsed.toFixed(1)}s` : `${Math.round(elapsed)}s`

  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <CatMascot mode="wagging" className="scale-75 -mb-2" />
      <span className="text-[12px] font-mono text-muted-foreground/60 tabular-nums">
        {timeStr}
      </span>
    </div>
  )
}
