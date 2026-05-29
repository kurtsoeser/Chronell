import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/components/ContextMenu'
import { ObjectNoteDialog } from '@/components/ObjectNoteEditor'
import { DashboardTileGrid } from '@/app/home/DashboardTileGrid'
import { useDashboardTileCatalog } from '@/app/home/use-dashboard-tile-catalog'

export function HomeDashboard(): JSX.Element {
  const { t } = useTranslation()
  const {
    tiles,
    getCustomTileBody,
    customWizardCalendarEvents,
    contextMenu,
    setContextMenu,
    noteTarget,
    setNoteTarget
  } = useDashboardTileCatalog({ prepareInboxPreview: true })

  return (
    <main
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
      aria-label={t('dashboard.mainAria')}
    >
      <div className="relative isolate min-h-full min-w-0 w-full flex-1 flex flex-col">
        <div className="dashboard-glass-canvas" aria-hidden />
        <div className="relative z-[1] flex min-h-full min-w-0 flex-1 flex-col">
          <div className="flex w-full shrink-0 flex-col gap-1 px-4 pb-2 pt-4">
            <h1 className="text-lg font-semibold text-foreground">{t('dashboard.heading')}</h1>
          </div>
          <DashboardTileGrid
            tiles={tiles}
            getCustomTileBody={getCustomTileBody}
            customWizardCalendarEvents={customWizardCalendarEvents}
          />
        </div>
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
    </main>
  )
}
