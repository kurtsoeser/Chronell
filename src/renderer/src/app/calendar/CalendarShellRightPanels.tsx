import type { TFunction } from 'i18next'
import { Fragment, useMemo, type MutableRefObject, type ReactNode } from 'react'
import type { CalendarShellColumnId } from '@/app/calendar/calendar-shell-column-order'
import { CalendarDockPanelSlide } from '@/app/calendar/CalendarDockPanelSlide'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { CalendarPreviewDockHeader } from '@/app/calendar/CalendarPreviewDockHeader'
import { CalendarRightZeitlistePanel } from '@/app/calendar/CalendarRightZeitlistePanel'
import { CalendarShellDockColumn } from '@/app/calendar/CalendarShellDockColumn'
import { resizeCalendarDockBetweenColumns } from '@/app/calendar/calendar-shell-dock-resize'
import { MailRightSidebar } from '@/app/layout/MailRightSidebar'
import { VerticalSplitter } from '@/components/ResizableSplitter'
import {
  CAL_FLOAT_CONTEXT_SIZE_KEY,
  CAL_FLOAT_INBOX_SIZE_KEY,
  CAL_FLOAT_PREVIEW_SIZE_KEY,
  CAL_SIDE_PANEL_MIN_WIDTH_PX,
} from '@/app/calendar/calendar-shell-storage'
import {
  CalendarShellColumnDndProvider,
  CalendarShellSortableColumn
} from '@/app/calendar/calendar-shell-column-dnd'
import { useCalendarPanelLayoutStore } from '@/stores/calendar-panel-layout'

export interface CalendarShellRightPanelsProps {
  t: TFunction
  calendarColumn: ReactNode
  previewBody: ReactNode
  refreshCalendarSize: () => void
  todoSideListRefreshKey: number
  timelineReloadRef: MutableRefObject<(() => void) | null>
  timelineLoading: boolean
  setTimelineLoading: (loading: boolean) => void
  applyTimelineWorkItemToPreview: (item: import('@shared/work-item').WorkItem) => void
  rightInboxOpen: boolean
  closeRightInbox: () => void
  rightPreviewOpen: boolean
  closeRightPreview: () => void
  inboxColumnWidth: number
  setInboxColumnWidth: (updater: (w: number) => number) => void
  previewPaneWidth: number
  setPreviewPaneWidth: (updater: (w: number) => number) => void
  contextColumnWidth: number
  setContextColumnWidth: (updater: (w: number) => number) => void
  sidePanelFloatMaxWidthPx: number
  inboxPlacement: 'dock' | 'float'
  previewPlacement: 'dock' | 'float'
  contextPlacement: 'dock' | 'float'
  rightContextOpen: boolean
  setInboxPlacement: (p: 'dock' | 'float') => void
  setPreviewPlacement: (p: 'dock' | 'float') => void
  setContextPlacement: (p: 'dock' | 'float') => void
  setRightContextOpen: (open: boolean) => void
  inboxDockShow: boolean
  previewDockShow: boolean
  contextDockShow: boolean
  inboxDockStripInDom: boolean
  setInboxDockStripInDom: (v: boolean) => void
  previewDockStripInDom: boolean
  setPreviewDockStripInDom: (v: boolean) => void
  contextDockStripInDom: boolean
  setContextDockStripInDom: (v: boolean) => void
  inboxFloatWidth: number
  previewFloatWidth: number
  contextFloatWidth: number
  useOsFloatingPanels: boolean
  inboxFloatPos: { x: number; y: number }
  previewFloatPos: { x: number; y: number }
  contextFloatPos: { x: number; y: number }
  previewColumnLabel: string
  undockPreviewPanel: () => void
  undockInboxPanel: () => void
  previewFocusStableKey: string | null
}

function isDockColumnMounted(
  id: CalendarShellColumnId,
  calendarColumnOpen: boolean,
  inboxDockStripInDom: boolean,
  previewDockStripInDom: boolean,
  contextDockStripInDom: boolean
): boolean {
  if (id === 'calendar') return calendarColumnOpen
  if (id === 'zeitliste') return inboxDockStripInDom
  if (id === 'preview') return previewDockStripInDom
  if (id === 'context') return contextDockStripInDom
  return false
}

function splitterAriaLabel(
  t: TFunction,
  left: CalendarShellColumnId,
  right: CalendarShellColumnId
): string {
  if (left === 'zeitliste' || right === 'zeitliste') {
    return t('calendar.shell.splitterInboxAria')
  }
  if (left === 'preview' || right === 'preview') {
    return t('calendar.shell.splitterPreviewAria')
  }
  if (left === 'context' || right === 'context') {
    return t('calendar.shell.splitterContextAria')
  }
  return t('calendar.shell.splitterPreviewAria')
}

export function CalendarShellRightPanels({
  t,
  calendarColumn,
  previewBody,
  refreshCalendarSize,
  todoSideListRefreshKey,
  timelineReloadRef,
  timelineLoading,
  setTimelineLoading,
  applyTimelineWorkItemToPreview,
  rightInboxOpen,
  closeRightInbox,
  rightPreviewOpen,
  closeRightPreview,
  inboxColumnWidth,
  setInboxColumnWidth,
  previewPaneWidth,
  setPreviewPaneWidth,
  contextColumnWidth,
  setContextColumnWidth,
  sidePanelFloatMaxWidthPx,
  inboxPlacement,
  previewPlacement,
  contextPlacement,
  rightContextOpen,
  setInboxPlacement,
  setPreviewPlacement,
  setContextPlacement,
  setRightContextOpen,
  inboxDockShow,
  previewDockShow,
  contextDockShow,
  inboxDockStripInDom,
  setInboxDockStripInDom,
  previewDockStripInDom,
  setPreviewDockStripInDom,
  contextDockStripInDom,
  setContextDockStripInDom,
  inboxFloatWidth,
  previewFloatWidth,
  contextFloatWidth,
  useOsFloatingPanels,
  inboxFloatPos,
  previewFloatPos,
  contextFloatPos,
  previewColumnLabel,
  undockPreviewPanel,
  undockInboxPanel,
  previewFocusStableKey
}: CalendarShellRightPanelsProps): JSX.Element {
  const columnOrder = useCalendarPanelLayoutStore((s) => s.columnOrder)
  const setColumnOrder = useCalendarPanelLayoutStore((s) => s.setColumnOrder)
  const calendarColumnOpen = useCalendarPanelLayoutStore((s) => s.calendarColumnOpen)

  const visibleDockColumnIds = useMemo(
    () =>
      columnOrder.filter((id) =>
        isDockColumnMounted(
          id,
          calendarColumnOpen,
          inboxDockStripInDom,
          previewDockStripInDom,
          contextDockStripInDom
        )
      ),
    [
      columnOrder,
      calendarColumnOpen,
      inboxDockStripInDom,
      previewDockStripInDom,
      contextDockStripInDom
    ]
  )

  const widthSetters = useMemo(
    () => ({
      zeitliste: setInboxColumnWidth,
      preview: setPreviewPaneWidth,
      context: setContextColumnWidth
    }),
    [setInboxColumnWidth, setPreviewPaneWidth, setContextColumnWidth]
  )

  const wrapSortable = (
    id: CalendarShellColumnId,
    isFirst: boolean,
    isLast: boolean,
    node: ReactNode,
    className?: string
  ): ReactNode => {
    if (!node) return null
    return (
      <CalendarShellSortableColumn key={id} id={id} className={className}>
        <CalendarShellDockColumn columnId={id} isFirst={isFirst} isLast={isLast}>
          {node}
        </CalendarShellDockColumn>
      </CalendarShellSortableColumn>
    )
  }

  const renderDockedColumnBody = (id: CalendarShellColumnId): ReactNode => {
    if (id === 'calendar') {
      return (
        <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
          {calendarColumn}
        </div>
      )
    }
    if (id === 'zeitliste') {
      if (!inboxDockStripInDom) return null
      return (
        <CalendarDockPanelSlide
          visible={inboxDockShow}
          panelWidthPx={inboxColumnWidth}
          onWidthTransitionEnd={refreshCalendarSize}
          onExitTransitionComplete={(): void => {
            if (!rightInboxOpen) setInboxDockStripInDom(false)
          }}
        >
          <div style={{ width: inboxColumnWidth }} className="h-full min-h-0 shrink-0">
            <CalendarRightZeitlistePanel
              open
              reloadSignal={todoSideListRefreshKey}
              reloadRef={timelineReloadRef}
              onWorkItemFocused={applyTimelineWorkItemToPreview}
              onTimelineLoadingChange={setTimelineLoading}
              listRefreshing={timelineLoading}
              onRequestClose={closeRightInbox}
              onRequestUndock={undockInboxPanel}
              previewFocusStableKey={previewFocusStableKey}
            />
          </div>
        </CalendarDockPanelSlide>
      )
    }
    if (id === 'preview') {
      if (!previewDockStripInDom) return null
      return (
        <CalendarDockPanelSlide
          visible={previewDockShow}
          panelWidthPx={previewPaneWidth}
          onWidthTransitionEnd={refreshCalendarSize}
          onExitTransitionComplete={(): void => {
            if (!rightPreviewOpen) setPreviewDockStripInDom(false)
          }}
        >
          <div
            style={{ width: previewPaneWidth }}
            className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden"
          >
            <CalendarPreviewDockHeader
              label={previewColumnLabel}
              undockTitle={t('calendar.shell.undockPreviewTitle')}
              hideTitle={t('calendar.shell.hidePreviewTitle')}
              onUndock={undockPreviewPanel}
              onHide={closeRightPreview}
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{previewBody}</div>
          </div>
        </CalendarDockPanelSlide>
      )
    }
    if (id === 'context') {
      if (!contextDockStripInDom) return null
      return (
        <CalendarDockPanelSlide
          visible={contextDockShow}
          panelWidthPx={contextColumnWidth}
          onWidthTransitionEnd={refreshCalendarSize}
          onExitTransitionComplete={(): void => {
            if (!rightContextOpen) setContextDockStripInDom(false)
          }}
        >
          <div
            style={{ width: contextColumnWidth }}
            className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden"
          >
            <CalendarPreviewDockHeader
              label={t('calendar.shell.contextSidebarTitle')}
              undockTitle={t('calendar.shell.undockContextTitle')}
              hideTitle={t('calendar.shell.hideContextTitle')}
              onUndock={(): void => setContextPlacement('float')}
              onHide={(): void => setRightContextOpen(false)}
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <MailRightSidebar hideChrome />
            </div>
          </div>
        </CalendarDockPanelSlide>
      )
    }
    return null
  }

  const renderDockedColumn = (
    id: CalendarShellColumnId,
    isFirst: boolean,
    isLast: boolean
  ): ReactNode => {
    const body = renderDockedColumnBody(id)
    if (!body) return null
    const sortableClass =
      id === 'calendar'
        ? 'flex h-full min-h-0 min-w-0 flex-1'
        : 'h-full shrink-0'
    return wrapSortable(id, isFirst, isLast, body, sortableClass)
  }

  return (
    <>
      <CalendarShellColumnDndProvider
        sortableIds={visibleDockColumnIds}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        onReorderComplete={refreshCalendarSize}
      >
        {visibleDockColumnIds.map((id, index) => {
          const leftId = index > 0 ? visibleDockColumnIds[index - 1] : null
          const isFirst = index === 0
          const isLast = index === visibleDockColumnIds.length - 1
          return (
            <Fragment key={id}>
              {leftId != null ? (
                <VerticalSplitter
                  onDrag={(delta): void => {
                    resizeCalendarDockBetweenColumns(leftId, id, delta, widthSetters)
                  }}
                  ariaLabel={splitterAriaLabel(t, leftId, id)}
                />
              ) : null}
              {renderDockedColumn(id, isFirst, isLast)}
            </Fragment>
          )
        })}
      </CalendarShellColumnDndProvider>
      {inboxPlacement === 'float' && !useOsFloatingPanels ? (
        <CalendarFloatingPanel
          open={rightInboxOpen}
          title={t('mega.shell.title')}
          widthPx={inboxFloatWidth}
          minHeightPx={320}
          persistSizeKey={CAL_FLOAT_INBOX_SIZE_KEY}
          minResizeWidthPx={CAL_SIDE_PANEL_MIN_WIDTH_PX}
          maxResizeWidthPx={sidePanelFloatMaxWidthPx}
          defaultPosition={inboxFloatPos}
          zIndex={88}
          onClose={closeRightInbox}
          onDock={(): void => setInboxPlacement('dock')}
        >
          <CalendarRightZeitlistePanel
            open
            reloadSignal={todoSideListRefreshKey}
            reloadRef={timelineReloadRef}
            onWorkItemFocused={applyTimelineWorkItemToPreview}
            onTimelineLoadingChange={setTimelineLoading}
            listRefreshing={timelineLoading}
            hideChrome
            onRequestClose={closeRightInbox}
            previewFocusStableKey={previewFocusStableKey}
          />
        </CalendarFloatingPanel>
      ) : null}
      {previewPlacement === 'float' && !useOsFloatingPanels ? (
        <CalendarFloatingPanel
          open={rightPreviewOpen}
          title={previewColumnLabel}
          widthPx={previewFloatWidth}
          minHeightPx={360}
          persistSizeKey={CAL_FLOAT_PREVIEW_SIZE_KEY}
          minResizeWidthPx={CAL_SIDE_PANEL_MIN_WIDTH_PX}
          maxResizeWidthPx={sidePanelFloatMaxWidthPx}
          defaultPosition={previewFloatPos}
          zIndex={92}
          onClose={closeRightPreview}
          onDock={(): void => setPreviewPlacement('dock')}
        >
          {previewBody}
        </CalendarFloatingPanel>
      ) : null}
      {contextPlacement === 'float' ? (
        <CalendarFloatingPanel
          open={rightContextOpen}
          title={t('calendar.shell.contextSidebarTitle')}
          widthPx={contextFloatWidth}
          minHeightPx={360}
          persistSizeKey={CAL_FLOAT_CONTEXT_SIZE_KEY}
          minResizeWidthPx={CAL_SIDE_PANEL_MIN_WIDTH_PX}
          maxResizeWidthPx={sidePanelFloatMaxWidthPx}
          defaultPosition={contextFloatPos}
          zIndex={94}
          onClose={(): void => setRightContextOpen(false)}
          onDock={(): void => setContextPlacement('dock')}
        >
          <MailRightSidebar hideChrome />
        </CalendarFloatingPanel>
      ) : null}
    </>
  )
}
