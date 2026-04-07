import * as React from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-primary/12 text-primary border-primary/20',
  secondary: 'bg-accent text-muted-foreground border-border',
  outline: 'bg-transparent text-foreground border-border',
  success: 'bg-success/12 text-success border-success/20',
  warning: 'bg-warning/14 text-warning border-warning/20',
  destructive: 'bg-destructive/12 text-destructive border-destructive/20',
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide',
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    />
  )
}
