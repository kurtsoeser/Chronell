import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResizableWidth, VerticalSplitter } from '@/components/ResizableSplitter'
import { cn } from '@/lib/utils'
import { modulePaneStackClass, moduleShellClass } from '@/components/module-shell-layout'
import { useModuleNavColumnWidth } from '@/lib/module-nav-column-width'
import {
  MAIL_LEFT_SIDEBAR_COLLAPSED_KEY,
  useModuleLeftSidebarCollapsed
} from '@/lib/module-left-sidebar-collapsed'
import { Sidebar } from '@/app/layout/Sidebar'
import { MailList } from '@/app/layout/MailList'
import { ReadingPane } from '@/app/layout/ReadingPane'
import { MailRightSidebar } from '@/app/layout/MailRightSidebar'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { useMailWorkspaceLayoutStore } from '@/stores/mail-workspace-layout'
import { useMailPendingFocusStore } from '@/stores/mail-pending-focus'
import { useMailStore } from '@/stores/mail'
import { loadUseOsFloatingPanelsDefault } from '@/lib/floating-panels-prefs'
import { openMailCalendarSidebarOsPopout } from '@/lib/open-panel-popout-helpers'
import { useMailReadingPopoutStore } from '@/stores/mail-reading-popout'

const MAIL_FLOAT_READING_SIZE_KEY = 'mailclient.mailWorkspace.readingFloatSize'
const MAIL_FLOAT_CALENDAR_SIZE_KEY = 'mailclient.mailWorkspace.calendarFloatSize'

export function MailWorkspace(props: { onOpenAccountDialog: () => void }): JSX.Element {
  const { t } = useTranslation()
  const pendingMessageId = useMailPendingFocusStore((s) => s.pendingMessageId)
  const takePendingMessageId = useMailPendingFocusStore((s) => s.takePendingMessageId)
  const openMessageInFolder = useMailStore((s) => s.openMessageInFolder)

  useEffect(() => {
    if (pendingMessageId == null) return
    const pendingId = takePendingMessageId()
    if (pendingId != null) void openMessageInFolder(pendingId)
  }, [pendingMessageId, takePendingMessageId, openMessageInFolder])
  const [sidebarWidth, setSidebarWidth] = useModuleNavColumnWidth()
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useModuleLeftSidebarCollapsed(
    MAIL_LEFT_SIDEBAR_COLLAPSED_KEY
  )
  const [listMaxWidth, setListMaxWidth] = useState(1200)
  useEffect(() => {
    const update = (): void => {
      setListMaxWidth(Math.max(720, Math.min(1400, Math.floor(window.innerWidth * 0.62))))
    }
    update()
    window.addEventListener('resize', update)
    return (): void => window.removeEventListener('resize', update)
  }, [])

  const [listWidth, setListWidth] = useResizableWidth({
    storageKey: 'mailclient.listWidth',
    defaultWidth: 384,
    minWidth: 260,
    maxWidth: listMaxWidth
  })

  useEffect(() => {
    setListWidth((w) => Math.min(w, listMaxWidth))
  }, [listMaxWidth, setListWidth])
  const [calendarColWidth, setCalendarColWidth] = useResizableWidth({
    storageKey: 'mailclient.inboxCalendarColumnWidth',
    defaultWidth: 348,
    minWidth: 220,
    maxWidth: 860
  })

  const readingPlacement = useMailWorkspaceLayoutStore((s) => s.readingPlacement)
  const calendarPlacement = useMailWorkspaceLayoutStore((s) => s.calendarPlacement)
  const readingOpen = useMailWorkspaceLayoutStore((s) => s.readingOpen)
  const calendarOpen = useMailWorkspaceLayoutStore((s) => s.calendarOpen)
  const setReadingPlacement = useMailWorkspaceLayoutStore((s) => s.setReadingPlacement)
  const setCalendarPlacement = useMailWorkspaceLayoutStore((s) => s.setCalendarPlacement)
  const setReadingOpen = useMailWorkspaceLayoutStore((s) => s.setReadingOpen)
  const setCalendarOpen = useMailWorkspaceLayoutStore((s) => s.setCalendarOpen)

  const onDragSidebar = useCallback(
    (delta: number) => setSidebarWidth((w) => w + delta),
    [setSidebarWidth]
  )
  const onDragList = useCallback(
    (delta: number) => setListWidth((w) => w + delta),
    [setListWidth]
  )
  /** Splitter liegt links von der Kalenderspalte — wie Kalender-Shell / Workflow-Vorschau (`w - delta`). */
  const onDragCalendarCol = useCallback(
    (delta: number) => setCalendarColWidth((w) => w - delta),
    [setCalendarColWidth]
  )

  const dockedReading = readingOpen && readingPlacement === 'dock'
  const dockedCalendar = calendarOpen && calendarPlacement === 'dock'
  const useOsFloatingPanels = loadUseOsFloatingPanelsDefault()
  const floatReading =
    readingOpen && readingPlacement === 'float' && !useOsFloatingPanels
  const floatCalendar =
    calendarOpen && calendarPlacement === 'float' && !useOsFloatingPanels

  const readingFloatWidth = useMemo(
    () => Math.min(720, Math.max(320, Math.round(calendarColWidth + 160))),
    [calendarColWidth]
  )
  const calendarFloatWidth = useMemo(
    () => Math.min(560, Math.max(288, Math.round(calendarColWidth))),
    [calendarColWidth]
  )

  const bothPanelsFloating = floatReading && floatCalendar

  const readingFloatPos = useMemo(() => {
    const x = Math.max(12, window.innerWidth - readingFloatWidth - 20)
    return { x, y: 68 }
  }, [readingFloatWidth])

  const calendarFloatPos = useMemo(() => {
    if (bothPanelsFloating) {
      const px = readingFloatPos.x
      return { x: Math.max(12, px - calendarFloatWidth - 12), y: 68 }
    }
    return { x: Math.max(12, window.innerWidth - calendarFloatWidth - 20), y: 68 }
  }, [bothPanelsFloating, calendarFloatWidth, readingFloatPos.x])

  const openReadingPopout = useMailReadingPopoutStore((s) => s.openFromCurrentSelection)

  const requestReadingUndock = useCallback((): void => {
    if (useOsFloatingPanels) {
      if (readingPlacement === 'float') {
        setReadingPlacement('dock')
        return
      }
      openReadingPopout()
      setReadingOpen(false)
      setReadingPlacement('dock')
      return
    }
    setReadingPlacement(readingPlacement === 'float' ? 'dock' : 'float')
  }, [
    useOsFloatingPanels,
    readingPlacement,
    setReadingPlacement,
    openReadingPopout,
    setReadingOpen
  ])

  const requestReadingGlobalPopout = useCallback(
    (opts?: { osWindow?: boolean; inAppFloat?: boolean }): void => {
      openReadingPopout(opts)
      if (useOsFloatingPanels && !opts?.inAppFloat) {
        setReadingOpen(false)
        setReadingPlacement('dock')
      }
    },
    [openReadingPopout, useOsFloatingPanels, setReadingOpen, setReadingPlacement]
  )
  const requestCalendarUndock = useCallback((): void => {
    if (useOsFloatingPanels) {
      void openMailCalendarSidebarOsPopout(t('mail.workspace.floatCalendarTitle'))
      setCalendarOpen(false)
      setCalendarPlacement('dock')
      return
    }
    setCalendarPlacement('float')
  }, [useOsFloatingPanels, setCalendarPlacement, setCalendarOpen, t])

  return (
    <div className={moduleShellClass}>
      {!leftSidebarCollapsed ? (
        <>
          <div style={{ width: sidebarWidth }} className="h-full shrink-0">
            <Sidebar onOpenAccountDialog={props.onOpenAccountDialog} />
          </div>
          <VerticalSplitter
            variant="moduleNav"
            onDrag={onDragSidebar}
            ariaLabel={t('common.moduleNavSplitter')}
          />
        </>
      ) : null}
      <div className={cn(modulePaneStackClass, 'flex-row')}>
      <div style={{ width: listWidth }} className="h-full shrink-0">
        <MailList
          leftSidebarCollapsed={leftSidebarCollapsed}
          onLeftSidebarCollapsedChange={setLeftSidebarCollapsed}
        />
      </div>
      <VerticalSplitter onDrag={onDragList} ariaLabel={t('mail.workspace.splitterList')} />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        {dockedReading ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ReadingPane
              previewDetached={false}
              onTogglePreviewDetach={requestReadingUndock}
              onRequestGlobalPopout={requestReadingGlobalPopout}
            />
          </div>
        ) : null}

        {dockedCalendar ? (
          <>
            {dockedReading ? (
              <VerticalSplitter
                onDrag={onDragCalendarCol}
                ariaLabel={t('mail.workspace.splitterCalendar')}
              />
            ) : null}
            <div
              style={dockedReading ? { width: calendarColWidth } : undefined}
              className={cn('h-full', dockedReading ? 'shrink-0' : 'min-w-0 min-h-0 flex-1')}
            >
              <MailRightSidebar
                onRequestUndock={requestCalendarUndock}
                onRequestClose={(): void => {
                  setCalendarOpen(false)
                }}
              />
            </div>
          </>
        ) : null}
      </div>
      </div>

      {floatReading ? (
        <CalendarFloatingPanel
          open
          title={t('mail.workspace.floatReadingTitle')}
          widthPx={readingFloatWidth}
          minHeightPx={360}
          persistSizeKey={MAIL_FLOAT_READING_SIZE_KEY}
          defaultPosition={readingFloatPos}
          zIndex={92}
          onClose={(): void => {
            setReadingOpen(false)
          }}
          onDock={(): void => {
            setReadingPlacement('dock')
          }}
        >
          <ReadingPane
            previewDetached
            hidePreviewDetachToggle
            onRequestGlobalPopout={requestReadingGlobalPopout}
          />
        </CalendarFloatingPanel>
      ) : null}

      {floatCalendar ? (
        <CalendarFloatingPanel
          open
          title={t('mail.workspace.floatCalendarTitle')}
          widthPx={calendarFloatWidth}
          minHeightPx={360}
          persistSizeKey={MAIL_FLOAT_CALENDAR_SIZE_KEY}
          defaultPosition={calendarFloatPos}
          zIndex={91}
          onClose={(): void => {
            setCalendarOpen(false)
          }}
          onDock={(): void => {
            setCalendarPlacement('dock')
          }}
        >
          <MailRightSidebar hideChrome />
        </CalendarFloatingPanel>
      ) : null}

    </div>
  )
}
