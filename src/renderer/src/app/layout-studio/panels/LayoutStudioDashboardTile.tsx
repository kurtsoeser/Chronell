import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  chronellDashboardTileBodyClass,
  chronellDashboardTileSubtitleClass,
  chronellDashboardTileTitleClass
} from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import type { DashboardTileId } from '@/app/home/dashboard-layout'
import { useDashboardTileCatalog } from '@/app/home/use-dashboard-tile-catalog'
import { ContextMenu } from '@/components/ContextMenu'
import { ObjectNoteDialog } from '@/components/ObjectNoteEditor'

export function LayoutStudioDashboardTile({ tileId }: { tileId: DashboardTileId }): JSX.Element {
  const { t } = useTranslation()
  const {
    tileById,
    contextMenu,
    setContextMenu,
    noteTarget,
    setNoteTarget
  } = useDashboardTileCatalog({ prepareInboxPreview: tileId === 'inbox' })

  const tile = useMemo(() => tileById.get(tileId), [tileById, tileId])

  if (!tile) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 text-center text-xs text-muted-foreground">
        {t('layoutStudio.tileNotFound', { id: tileId })}
      </div>
    )
  }

  const Icon = tile.icon as LucideIcon | undefined

  return (
    <div className="chronell-dashboard-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="chronell-dashboard-panel-header flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
        <div className="min-w-0 flex-1">
          {tile.onOpenFull ? (
            <button type="button" onClick={tile.onOpenFull} className="block w-full text-left">
              <span className={chronellDashboardTileTitleClass}>{tile.title}</span>
              {tile.subtitle ? (
                <span className={cn(chronellDashboardTileSubtitleClass, 'block truncate')}>
                  {tile.subtitle}
                </span>
              ) : null}
            </button>
          ) : (
            <>
              <span className={chronellDashboardTileTitleClass}>{tile.title}</span>
              {tile.subtitle ? (
                <span className={cn(chronellDashboardTileSubtitleClass, 'block truncate')}>
                  {tile.subtitle}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className={cn(chronellDashboardTileBodyClass, 'min-h-0 flex-1 overflow-hidden')}>
        {tile.body}
      </div>
      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={(): void => setContextMenu(null)}
        />
      ) : null}
      <ObjectNoteDialog target={noteTarget} onClose={(): void => setNoteTarget(null)} />
    </div>
  )
}
