import { cn } from '@/lib/utils'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'

export function NotesCategoryBadges({
  names,
  colorByName,
  className,
  maxVisible = 3
}: {
  names: string[]
  colorByName: Map<string, string>
  className?: string
  maxVisible?: number
}): JSX.Element | null {
  if (names.length === 0) return null
  const visible = names.slice(0, maxVisible)
  const rest = names.length - visible.length
  return (
    <span className={cn('inline-flex min-w-0 flex-wrap items-center gap-1', className)}>
      {visible.map((name) => (
        <span
          key={name}
          className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded-full bg-secondary/60 px-1.5 py-0.5 text-2xs text-muted-foreground"
          title={name}
        >
          <span
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', outlookCategoryDotClass(colorByName.get(name)))}
            aria-hidden
          />
          <span className="truncate">{name}</span>
        </span>
      ))}
      {rest > 0 ? (
        <span className="text-2xs text-muted-foreground" title={names.slice(maxVisible).join(', ')}>
          +{rest}
        </span>
      ) : null}
    </span>
  )
}
