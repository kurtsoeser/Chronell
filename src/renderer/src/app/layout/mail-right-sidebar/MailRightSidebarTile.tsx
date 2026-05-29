import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { LucideIcon } from 'lucide-react'
import { EyeOff, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  chronellDashboardTileBodyCompactClass,
  chronellDashboardTileSubtitleClass,
  chronellDashboardTileTitleClass
} from '@/lib/chronell-ui-classes'

export function MailRightSidebarTile(props: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  onOpenFull?: () => void
  hideDisabled?: boolean
  onHide: () => void
  className?: string
  bodyClassName?: string
  isDragging?: boolean
  dragHandleAttributes?: DraggableAttributes
  dragHandleListeners?: DraggableSyntheticListeners
  children: React.ReactNode
}): JSX.Element {
  const { t } = useTranslation()
  const {
    title,
    subtitle,
    icon: Icon,
    onOpenFull,
    hideDisabled = false,
    onHide,
    className,
    bodyClassName,
    isDragging = false,
    dragHandleAttributes,
    dragHandleListeners,
    children
  } = props

  const sortable = dragHandleAttributes != null && dragHandleListeners != null

  return (
    <section
      data-mail-sidebar-tile
      className={cn(
        'chronell-dashboard-panel dashboard-tile flex w-full min-w-0 flex-col overflow-hidden',
        isDragging && 'shadow-md ring-1 ring-primary/25',
        className
      )}
    >
      <div className="chronell-dashboard-panel-header dashboard-tile-header flex shrink-0 items-center gap-2 border-b border-border/60 px-2 py-1.5">
        {sortable ? (
          <button
            type="button"
            className={cn(
              'flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/70',
              'hover:bg-secondary/60 hover:text-foreground active:cursor-grabbing'
            )}
            title={t('mail.rightSidebar.dragTileTitle')}
            aria-label={t('mail.rightSidebar.dragTileAria')}
            {...dragHandleAttributes}
            {...dragHandleListeners}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {Icon ? (
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary/85" strokeWidth={1.75} aria-hidden />
        ) : null}
        {onOpenFull ? (
          <button
            type="button"
            className="min-w-0 flex-1 rounded-md px-0.5 py-0 text-left hover:bg-secondary/50"
            onClick={onOpenFull}
          >
            <div className={cn(chronellDashboardTileTitleClass, 'truncate')}>{title}</div>
            {subtitle ? (
              <div className={cn(chronellDashboardTileSubtitleClass, 'truncate')}>{subtitle}</div>
            ) : null}
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <div className={cn(chronellDashboardTileTitleClass, 'truncate')}>{title}</div>
            {subtitle ? (
              <div className={cn(chronellDashboardTileSubtitleClass, 'truncate')}>{subtitle}</div>
            ) : null}
          </div>
        )}
        <button
          type="button"
          disabled={hideDisabled}
          title={t('mail.rightSidebar.hideTileTitle')}
          aria-label={t('mail.rightSidebar.hideTileAria')}
          onClick={onHide}
          className={cn(
            'shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
            hideDisabled && 'pointer-events-none opacity-40'
          )}
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className={cn(chronellDashboardTileBodyCompactClass, bodyClassName)}>{children}</div>
    </section>
  )
}
