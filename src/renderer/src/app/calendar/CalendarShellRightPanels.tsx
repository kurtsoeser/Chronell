import type { TFunction } from 'i18next'
import type { MutableRefObject, ReactNode } from 'react'
import { CalendarDockPanelSlide } from '@/app/calendar/CalendarDockPanelSlide'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { CalendarPreviewDockHeader } from '@/app/calendar/CalendarPreviewDockHeader'
import { CalendarRightZeitlistePanel } from '@/app/calendar/CalendarRightZeitlistePanel'
import { MailRightSidebar } from '@/app/layout/MailRightSidebar'
import { VerticalSplitter } from '@/components/ResizableSplitter'
import {
  CAL_FLOAT_CONTEXT_SIZE_KEY,
  CAL_FLOAT_INBOX_SIZE_KEY,
  CAL_FLOAT_PREVIEW_SIZE_KEY,
  CAL_SIDE_PANEL_MIN_WIDTH_PX,
} from '@/app/calendar/calendar-shell-storage'

export interface CalendarShellRightPanelsProps {
  t: TFunction
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
}

export function CalendarShellRightPanels({
  t,
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
  undockInboxPanel
}: CalendarShellRightPanelsProps): JSX.Element {
  return (
    <>
      {inboxDockStripInDom ? (
        <CalendarDockPanelSlide
          visible={inboxDockShow}
          panelWidthPx={inboxColumnWidth}
          onWidthTransitionEnd={refreshCalendarSize}
          onExitTransitionComplete={(): void => {
            if (!rightInboxOpen) setInboxDockStripInDom(false)
          }}
          splitter={
            <VerticalSplitter
              onDrag={(delta): void => setInboxColumnWidth((w) => w - delta)}
              ariaLabel={t('calendar.shell.splitterInboxAria')}
            />
          }
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
            />
          </div>
        </CalendarDockPanelSlide>
      ) : null}
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
          />
        </CalendarFloatingPanel>
      ) : null}
      {previewDockStripInDom ? (
        <CalendarDockPanelSlide
          visible={previewDockShow}
          panelWidthPx={previewPaneWidth}
          onWidthTransitionEnd={refreshCalendarSize}
          onExitTransitionComplete={(): void => {
            if (!rightPreviewOpen) setPreviewDockStripInDom(false)
          }}
          splitter={
            <VerticalSplitter
              onDrag={(delta): void => setPreviewPaneWidth((w) => w - delta)}
              ariaLabel={t('calendar.shell.splitterPreviewAria')}
            />
          }
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
      {contextDockStripInDom ? (
        <CalendarDockPanelSlide
          visible={contextDockShow}
          panelWidthPx={contextColumnWidth}
          onWidthTransitionEnd={refreshCalendarSize}
          onExitTransitionComplete={(): void => {
            if (!rightContextOpen) setContextDockStripInDom(false)
          }}
          splitter={
            <VerticalSplitter
              onDrag={(delta): void => setContextColumnWidth((w) => w - delta)}
              ariaLabel={t('calendar.shell.splitterContextAria')}
            />
          }
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
