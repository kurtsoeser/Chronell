import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResizableWidth, VerticalSplitter } from '@/components/ResizableSplitter'
import { cn } from '@/lib/utils'
import { modulePaneStackClass, moduleShellClass } from '@/components/module-shell-layout'
import { useModuleNavColumnWidth } from '@/lib/module-nav-column-width'
import { Sidebar } from '@/app/layout/Sidebar'
import { MailList } from '@/app/layout/MailList'
import { ReadingPane } from '@/app/layout/ReadingPane'
import { MailRightSidebar } from '@/app/layout/MailRightSidebar'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { useMailWorkspaceLayoutStore } from '@/stores/mail-workspace-layout'
import { useMailPendingFocusStore } from '@/stores/mail-pending-focus'
import { useMailStore } from '@/stores/mail'
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
  const floatReading = readingOpen && readingPlacement === 'float'
  const floatCalendar = calendarOpen && calendarPlacement === 'float'

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
    setReadingPlacement(readingPlacement === 'float' ? 'dock' : 'float')
  }, [readingPlacement, setReadingPlacement])

  const requestReadingGlobalPopout = useCallback(
    (opts?: { osWindow?: boolean }): void => {
      openReadingPopout({ osWindow: opts?.osWindow === true })
    },
    [openReadingPopout]
  )
  const requestCalendarUndock = useCallback((): void => {
    setCalendarPlacement('float')
  }, [setCalendarPlacement])

  return (
    <div className={moduleShellClass}>
      <div style={{ width: sidebarWidth }} className="h-full shrink-0">
        <Sidebar onOpenAccountDialog={props.onOpenAccountDialog} />
      </div>
      <VerticalSplitter
        variant="moduleNav"
        onDrag={onDragSidebar}
        ariaLabel={t('common.moduleNavSplitter')}
      />
      <div className={cn(modulePaneStackClass, 'flex-row')}>
      <div style={{ width: listWidth }} className="h-full shrink-0">
        <MailList />
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
        ) : dockedCalendar ? (
          <div className="min-h-0 min-w-0 flex-1 bg-background" aria-hidden />
        ) : null}

        {dockedCalendar ? (
          <>
            <VerticalSplitter onDrag={onDragCalendarCol} ariaLabel={t('mail.workspace.splitterCalendar')} />
            <div style={{ width: calendarColWidth }} className="h-full shrink-0">
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
