import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OnboardingOptionCardProps {
  selected: boolean
  onSelect: () => void
  icon?: LucideIcon
  iconNode?: React.ReactNode
  title: React.ReactNode
  description?: string
  recommended?: boolean
  disabled?: boolean
  className?: string
  layout?: 'row' | 'column'
}

export function OnboardingOptionCard({
  selected,
  onSelect,
  icon: Icon,
  iconNode,
  title,
  description,
  recommended,
  disabled,
  className,
  layout = 'row'
}: OnboardingOptionCardProps): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border text-left transition-colors',
        layout === 'column' ? 'flex flex-col items-center gap-3 p-5' : 'flex items-start gap-3 p-3.5',
        selected
          ? 'border-primary/50 bg-primary/8 ring-1 ring-primary/25'
          : 'border-border bg-card hover:border-primary/30 hover:bg-secondary/40',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {iconNode ? (
        <div className={cn('shrink-0', layout === 'column' && 'flex justify-center')}>{iconNode}</div>
      ) : Icon ? (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md border border-border bg-background',
            layout === 'column' ? 'h-14 w-14' : 'h-10 w-10'
          )}
        >
          <Icon className={cn('text-muted-foreground', layout === 'column' ? 'h-7 w-7' : 'h-5 w-5')} />
        </div>
      ) : null}
      <div className={cn('min-w-0', layout === 'column' && 'text-center')}>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {recommended ? (
        <span className="sr-only"> ({/* recommended marker in title */})</span>
      ) : null}
    </button>
  )
}

export function OnboardingRecommendedTag({ label }: { label: string }): JSX.Element {
  return <span className="font-normal text-rose-600 dark:text-rose-400"> ({label})</span>
}
