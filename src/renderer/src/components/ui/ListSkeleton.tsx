import React from 'react'

export function ListSkeleton({ count = 3 }: { count?: number }): React.ReactElement {
  return (
    <div className="space-y-2 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl bg-muted h-24 w-full" />
      ))}
    </div>
  )
}
