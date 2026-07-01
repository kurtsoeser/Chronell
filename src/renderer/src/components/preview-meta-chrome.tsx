import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PreviewMetaDot(): JSX.Element {
  return (
    <span className="text-muted-foreground/40" aria-hidden>
      ·
    </span>
  )
}

export function PreviewMetaRow({
  label,
  children,
  className
}: {
  label: string
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div
      className={cn(
        'grid grid-cols-[6.5rem_minmax(0,1fr)] border-b border-border/50 last:border-b-0',
        className
      )}
    >
      <div className="flex items-start justify-end bg-muted/50 px-2 py-2 text-right text-xs italic text-muted-foreground">
        {label}
      </div>
      <div className="min-h-[2.25rem] bg-background px-2 py-1.5 text-sm text-foreground">{children}</div>
    </div>
  )
}
