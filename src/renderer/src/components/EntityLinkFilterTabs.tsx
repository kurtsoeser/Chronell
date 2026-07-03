import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type EntityLinkFilterTabValue<TKind extends string = string> = TKind | 'all'

export interface EntityLinkFilterTabsProps<TKind extends string = string> {
  value: TKind | 'all'
  onChange: (value: TKind | 'all') => void
  kinds: readonly TKind[]
  className?: string
  /** Verhindert Fokusverlust im TipTap-Editor beim Tab-Klick. */
  preventMouseDownDefault?: boolean
}

export function EntityLinkFilterTabs<TKind extends string = string>({
  value,
  onChange,
  kinds,
  className,
  preventMouseDownDefault = false
}: EntityLinkFilterTabsProps<TKind>): JSX.Element {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
      role="tablist"
      aria-label={t('notes.entityMention.filterTabsAria')}
    >
      <EntityLinkFilterTab
        active={value === 'all'}
        onClick={(): void => onChange('all')}
        preventMouseDownDefault={preventMouseDownDefault}
      >
        {t('notes.links.filterAll')}
      </EntityLinkFilterTab>
      {kinds.map((kind) => (
        <EntityLinkFilterTab
          key={kind}
          active={value === kind}
          onClick={(): void => onChange(kind)}
          preventMouseDownDefault={preventMouseDownDefault}
        >
          {t(`notes.links.kind.${kind}`)}
        </EntityLinkFilterTab>
      ))}
    </div>
  )
}

function EntityLinkFilterTab({
  active,
  onClick,
  preventMouseDownDefault,
  children
}: {
  active: boolean
  onClick: () => void
  preventMouseDownDefault?: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onMouseDown={
        preventMouseDownDefault
          ? (e): void => {
              e.preventDefault()
            }
          : undefined
      }
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors',
        active
          ? 'bg-foreground text-background shadow-sm'
          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
