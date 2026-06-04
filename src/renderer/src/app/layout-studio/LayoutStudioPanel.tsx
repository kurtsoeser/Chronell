import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/components/ContextMenu'
import { ObjectNoteDialog } from '@/components/ObjectNoteEditor'
import { DashboardTileGrid } from '@/app/home/DashboardTileGrid'
import { useDashboardTileCatalog } from '@/app/home/use-dashboard-tile-catalog'
import { InboxCalendarSidebar } from '@/app/layout/InboxCalendarSidebar'
import { MailList } from '@/app/layout/MailList'
import { MailRightSidebar } from '@/app/layout/MailRightSidebar'
import { MailRightSidebarDashboard } from '@/app/layout/mail-right-sidebar/MailRightSidebarDashboard'
import { MailCalendarDaySidebar } from '@/app/layout/mail-right-sidebar/MailCalendarDaySidebar'
import { MailContactDetailsSidebar } from '@/app/layout/mail-right-sidebar/MailContactDetailsSidebar'
import { MailTasksSidebar } from '@/app/layout/mail-right-sidebar/MailTasksSidebar'
import { MailNotesSidebar } from '@/app/layout/mail-right-sidebar/MailNotesSidebar'
import { ReadingPane } from '@/app/layout/ReadingPane'
import { LayoutStudioComposer } from '@/app/layout-studio/panels/LayoutStudioComposer'
import { LayoutStudioEventPreview } from '@/app/layout-studio/panels/LayoutStudioEventPreview'
import { LayoutStudioMailFolders } from '@/app/layout-studio/panels/LayoutStudioMailFolders'
import { LayoutStudioZeitliste } from '@/app/layout-studio/panels/LayoutStudioZeitliste'
import {
  LayoutStudioCalendarMonth,
  LayoutStudioCalendarMonthFull,
  LayoutStudioCalendarToday,
  LayoutStudioCalendarWeek,
  LayoutStudioCalendarWeekFull
} from '@/app/layout-studio/panels/LayoutStudioCalendarViews'
import { LayoutStudioDashboardTile } from '@/app/layout-studio/panels/LayoutStudioDashboardTile'
import { parseDashboardTileIdFromPanel } from '@/app/layout-studio/layout-studio-panel-ids'
import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-storage'

export function LayoutStudioPanel({ panel }: { panel: LayoutStudioPanelId }): JSX.Element {
  const { t } = useTranslation()

  const tileId = parseDashboardTileIdFromPanel(panel)
  if (tileId) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioDashboardTile tileId={tileId} />
      </div>
    )
  }

  if (panel === 'none') {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
        {t('layoutStudio.panelEmpty')}
      </div>
    )
  }

  if (panel === 'startDashboard') {
    return <LayoutStudioStartDashboard />
  }

  if (panel === 'mailList') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MailList />
      </div>
    )
  }

  if (panel === 'reading') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ReadingPane hidePreviewDetachToggle compactToolbar />
      </div>
    )
  }

  if (panel === 'contextSidebar') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MailRightSidebar />
      </div>
    )
  }

  if (panel === 'dashboardSidebar') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MailRightSidebarDashboard />
      </div>
    )
  }

  if (panel === 'agenda') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <InboxCalendarSidebar />
      </div>
    )
  }

  if (panel === 'calendarDay' || panel === 'calendarMain') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MailCalendarDaySidebar />
      </div>
    )
  }

  if (panel === 'contactSidebar') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MailContactDetailsSidebar />
      </div>
    )
  }

  if (panel === 'tasksSidebar') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MailTasksSidebar />
      </div>
    )
  }

  if (panel === 'notesSidebar') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MailNotesSidebar />
      </div>
    )
  }

  if (panel === 'mailFolders') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioMailFolders />
      </div>
    )
  }

  if (panel === 'zeitliste') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioZeitliste />
      </div>
    )
  }

  if (panel === 'eventPreview' || panel === 'contextPreview') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioEventPreview />
      </div>
    )
  }

  if (panel === 'composer') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioComposer />
      </div>
    )
  }

  if (panel === 'calendarWeek') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioCalendarWeek />
      </div>
    )
  }

  if (panel === 'calendarMonth') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioCalendarMonth />
      </div>
    )
  }

  if (panel === 'calendarWeekFull') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioCalendarWeekFull />
      </div>
    )
  }

  if (panel === 'calendarMonthFull') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioCalendarMonthFull />
      </div>
    )
  }

  if (panel === 'calendarToday') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LayoutStudioCalendarToday />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {t('layoutStudio.panelUnknown')}
    </div>
  )
}

function LayoutStudioStartDashboard(): JSX.Element {
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
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div className="dashboard-glass-canvas" aria-hidden />
      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        <DashboardTileGrid
          tiles={tiles}
          getCustomTileBody={getCustomTileBody}
          customWizardCalendarEvents={customWizardCalendarEvents}
        />
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
