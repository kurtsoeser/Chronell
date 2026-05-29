import { useTranslation } from 'react-i18next'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'
import { cn } from '@/lib/utils'

export interface TaskCategoryBadgesProps {
  categories?: string[]
  categoryColorByName?: Map<string, string>
  /** Kompakte Darstellung als Farbpunkte (z. B. enge Listenzeilen). */
  compact?: boolean
  className?: string
}

export function TaskCategoryBadges({
  categories,
  categoryColorByName,
  compact,
  className
}: TaskCategoryBadgesProps): JSX.Element | null {
  const { t } = useTranslation()
  const cats = (categories ?? []).map((c) => c.trim()).filter((c) => c.length > 0)
  if (cats.length === 0) return null

  if (compact) {
    const max = 6
    const shown = cats.slice(0, max)
    return (
      <span
        className={cn('inline-flex shrink-0 items-center gap-px', className)}
        title={cats.join(', ')}
        aria-label={t('mail.list.categoriesDotsAria', { list: cats.join(', ') })}
      >
        {shown.map((c, i) => (
          <span
            key={`${c}:${i}`}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              outlookCategoryDotClass(categoryColorByName?.get(c))
            )}
          />
        ))}
        {cats.length > max ? (
          <span className="text-[8px] leading-none text-muted-foreground">+</span>
        ) : null}
      </span>
    )
  }

  const max = 4
  const shown = cats.slice(0, max)
  const extra = cats.length - shown.length
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown.map((c, i) => (
        <span
          key={`${c}:${i}`}
          title={c}
          className="inline-flex max-w-[6rem] items-center gap-0.5 rounded border border-border/50 bg-secondary/30 px-1 py-px text-[9px] font-medium text-foreground/90"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              outlookCategoryDotClass(categoryColorByName?.get(c))
            )}
          />
          <span className="truncate">{c}</span>
        </span>
      ))}
      {extra > 0 ? (
        <span className="text-[9px] text-muted-foreground" title={cats.slice(max).join(', ')}>
          +{extra}
        </span>
      ) : null}
    </div>
  )
}
