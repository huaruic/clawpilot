import * as React from 'react'
import { cn } from '../../lib/utils'

export function ScrollArea({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('overflow-auto', className)} {...props} />
}
