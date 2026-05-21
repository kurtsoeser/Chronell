import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { entityContextDividerClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'

/** Einheitlicher Aufklapp-Bereich in Modul-Vorschauen (Notiz, Kontext, …). */
export function PreviewFoldSection({
  icon: Icon,
  title,
  expanded,
  onToggle,
  summary,
  trailing,
  children,
  className,
  contentClassName,
  iconClassName
}: {
  icon: LucideIcon
  title: string
  expanded: boolean
  onToggle: () => void
  summary?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
  className?: string
  contentClassName?: string
  iconClassName?: string
}): JSX.Element {
  return (
    <section className={cn('border-t', entityContextDividerClass, className)}>
      <div className="flex items-center gap-2 px-6 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-xs font-medium text-foreground transition-colors hover:bg-secondary/30"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <Icon
            className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', iconClassName)}
            aria-hidden
          />
          <span className="min-w-0 shrink-0">{title}</span>
          {!expanded && summary != null ? (
            <span className="min-w-0 flex-1 truncate text-[10px] font-normal text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </button>
        {trailing != null ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
      </div>
      {expanded && children != null ? (
        <div className={cn('px-6 pb-3', contentClassName)}>{children}</div>
      ) : null}
    </section>
  )
}
