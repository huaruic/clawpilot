import React, { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center w-full">
      <Icon className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm">{description}</p>
      {action && <div>{action}</div>}
    </div>
  )
}
