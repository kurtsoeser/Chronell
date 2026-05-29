import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComposeCollapsibleSectionProps {
  label: string
  /** true = eingeklappt beim ersten Render */
  collapsedDefault?: boolean
  /** Abgerundete Kachel wie Mail-Text (z. B. Original-Mail). */
  framed?: boolean
  headerAside?: ReactNode
  children: ReactNode
  className?: string
}

export function ComposeCollapsibleSection({
  label,
  collapsedDefault = false,
  framed = false,
  headerAside,
  children,
  className
}: ComposeCollapsibleSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(collapsedDefault)

  return (
    <div
      className={cn(
        framed ? 'compose-mail-body-tile' : 'rounded-xl border border-[hsl(var(--compose-surface-border)/0.45)]',
        'flex min-h-0 flex-col overflow-hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={(): void => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className={cn(
          'flex w-full shrink-0 items-center gap-1.5 px-3 py-1.5 text-left',
          'text-[11px] font-medium text-muted-foreground hover:text-foreground',
          !framed && 'border-b border-[hsl(var(--compose-surface-border)/0.35)]'
        )}
      >
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', collapsed && '-rotate-90')}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {headerAside ? (
          <span
            className="flex shrink-0 items-center gap-1"
            onClick={(e): void => e.stopPropagation()}
            onKeyDown={(e): void => e.stopPropagation()}
          >
            {headerAside}
          </span>
        ) : null}
      </button>
      {!collapsed ? <div className="min-h-0 flex-1">{children}</div> : null}
    </div>
  )
}
