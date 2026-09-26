import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { entityContextDividerClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'

/** Einheitlicher Aufklapp-Bereich in Modul-Vorschauen (Info, Copilot, Notiz, Kontext, …). */
export function PreviewFoldSection({
  icon: Icon,
  title,
  expanded,
  onToggle,
  summary,
  summaryLines = 1,
  trailing,
  children,
  className,
  contentClassName,
  iconClassName,
  /**
   * `fold` — Standard in Modul-Vorschauen.
   * `property` — gleiche Ebene wie `PropertyRow` (Termin-Dialog: Beschreibung / Notiz / Kontext).
   */
  headerVariant = 'fold',
  /** Horizontales Padding für Header und Inhalt (Standard: px-4 bzw. px-1 bei property). */
  paddingClass
}: {
  icon: LucideIcon
  title: string
  expanded: boolean
  onToggle: () => void
  summary?: ReactNode
  /** Zeilen für die eingeklappte Vorschau (1 = eine Zeile truncaten, 3 = line-clamp-3). */
  summaryLines?: 1 | 2 | 3
  trailing?: ReactNode
  children?: ReactNode
  className?: string
  contentClassName?: string
  iconClassName?: string
  headerVariant?: 'fold' | 'property'
  paddingClass?: string
}): JSX.Element {
  const multiLineSummary = !expanded && summary != null && summaryLines > 1
  const isProperty = headerVariant === 'property'
  const pad = paddingClass ?? (isProperty ? 'px-1' : 'px-4')
  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <section
      className={cn(
        'border-t',
        entityContextDividerClass,
        expanded && children != null && 'flex min-h-0 flex-col',
        className
      )}
    >
      <div
        className={cn(
          'flex shrink-0 gap-2 py-2',
          multiLineSummary ? 'items-start' : 'items-center',
          isProperty && 'gap-3 py-2',
          pad
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={cn(
            'flex min-w-0 flex-1 gap-2 rounded-md py-0.5 text-left transition-colors hover:bg-secondary/30',
            isProperty
              ? 'items-start gap-3 text-xs font-medium text-muted-foreground hover:text-foreground'
              : 'text-xs font-medium text-foreground',
            !isProperty && (multiLineSummary ? 'items-start' : 'items-center')
          )}
        >
          <Icon
            className={cn(
              'shrink-0 text-muted-foreground',
              isProperty ? 'mt-0.5 h-4 w-4' : 'h-3.5 w-3.5',
              !isProperty && multiLineSummary && 'mt-0.5',
              iconClassName
            )}
            aria-hidden
          />
          {multiLineSummary ? (
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'flex items-center gap-1.5',
                  isProperty && 'uppercase tracking-wide'
                )}
              >
                <span className="min-w-0">{title}</span>
                <Chevron
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <span
                className={cn(
                  'mt-0.5 block text-[10px] font-normal leading-snug text-muted-foreground',
                  summaryLines === 2 && 'line-clamp-2',
                  summaryLines === 3 && 'line-clamp-3'
                )}
              >
                {summary}
              </span>
            </span>
          ) : (
            <>
              <span
                className={cn(
                  'min-w-0 shrink-0',
                  isProperty && 'uppercase tracking-wide'
                )}
              >
                {title}
              </span>
              <Chevron
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-muted-foreground',
                  isProperty && 'mt-0.5'
                )}
                aria-hidden
              />
              {!expanded && summary != null ? (
                <span className="min-w-0 flex-1 truncate text-[10px] font-normal text-muted-foreground">
                  {summary}
                </span>
              ) : null}
            </>
          )}
        </button>
        {trailing != null ? (
          <div
            className={cn(
              'flex shrink-0 items-center gap-1',
              multiLineSummary && 'mt-0.5'
            )}
          >
            {trailing}
          </div>
        ) : null}
      </div>
      {expanded && children != null ? (
        <div className={cn('pb-3', pad, contentClassName)}>{children}</div>
      ) : null}
    </section>
  )
}
