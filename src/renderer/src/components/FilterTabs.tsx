import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FilterTabOption<T extends string> {
  id: T
  label: string
  count?: number
  /** Optionales Icon links vom Label (z. B. Lucide mit `className="h-3.5 w-3.5"`). */
  icon?: ReactNode
}

interface Props<T extends string> {
  value: T
  options: FilterTabOption<T>[]
  onChange: (id: T) => void
  className?: string
  ariaLabel?: string
  /** Kompaktere Tabs für schmale Seitenleisten (z. B. Kontakt-Panel). */
  size?: 'default' | 'compact'
}

/**
 * Segmented-Control im Stil von Front/Dappr/BOXMAIL fuer Filter-Tabs
 * ueber Listen. Aktives Element bekommt einen weichen Akzent-Hintergrund
 * + Akzent-Underline, inaktive bleiben rein textbasiert.
 */
export function FilterTabs<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
  size = 'default'
}: Props<T>): JSX.Element {
  const compact = size === 'compact'
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex items-center gap-1', className)}
    >
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={(): void => onChange(opt.id)}
            className={cn(
              'group relative inline-flex items-center rounded-md font-medium transition-colors',
              compact ? 'h-7 gap-1 px-2 text-2xs' : 'h-8 gap-1.5 px-2.5 text-xs',
              active
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            )}
          >
            {opt.icon ? (
              <span
                className={cn(
                  'flex shrink-0',
                  active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
                aria-hidden
              >
                {opt.icon}
              </span>
            ) : null}
            <span className="truncate">{opt.label}</span>
            {opt.count !== undefined && opt.count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] tabular-nums leading-4',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
