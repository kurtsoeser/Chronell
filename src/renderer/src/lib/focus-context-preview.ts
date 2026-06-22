import type { CalendarEventView, TaskItemRow } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { openWorkItemInCalendar } from '@/app/work-items/work-item-calendar-nav'
import { walkZoneLeaves } from '@/app/layout-studio/layout-zone-model'
import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { resolveVisibleAppShellMode } from '@/app/layout/topbar-module-prefs'
import { openCalendarPreviewOsPopout } from '@/lib/open-panel-popout-helpers'
import { openMailReadingPopout } from '@/lib/open-mail-reading-popout'
import type { AppShellMode } from '@/stores/app-mode'
import { useAppModeStore } from '@/stores/app-mode'
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'
import { useCustomViewsStore } from '@/stores/custom-views'
import { useLayoutStudioPreviewStore } from '@/stores/layout-studio-preview-store'
import { useMailStore } from '@/stores/mail'

const CONTEXT_PREVIEW_PANELS: readonly LayoutStudioPanelId[] = ['contextPreview', 'eventPreview']
const MAIL_PREVIEW_PANELS: readonly LayoutStudioPanelId[] = ['contextPreview', 'eventPreview', 'reading']

function isInCustomViewShell(): boolean {
  return useAppModeStore.getState().mode === 'customView'
}

function isCustomViewZonePopout(): boolean {
  return parsePanelPopoutRoute()?.panel === 'custom-view-zone'
}

/** Eingebettete Kontext-Vorschau in einer eigenen Ansicht (Layout-Zone). */
export function isCustomViewContextPreviewActive(): boolean {
  return isInCustomViewShell() || isCustomViewZonePopout()
}

function activeCustomViewZoneRoot() {
  if (isCustomViewZonePopout()) {
    const viewId = parsePanelPopoutRoute()?.params.get('viewId')?.trim()
    if (!viewId) return null
    return useCustomViewsStore.getState().views.find((v) => v.id === viewId)?.zoneRoot ?? null
  }
  const { activeViewId, views } = useCustomViewsStore.getState()
  if (!activeViewId) return null
  return views.find((v) => v.id === activeViewId)?.zoneRoot ?? null
}

export function customViewHasAnyPanel(panels: readonly LayoutStudioPanelId[]): boolean {
  const root = activeCustomViewZoneRoot()
  if (!root) return false
  let found = false
  walkZoneLeaves(root, (leaf) => {
    if (panels.includes(leaf.panel)) found = true
  })
  return found
}

function calendarEventPopoutTitle(event: CalendarEventView): string {
  return event.title?.trim() || 'Termin'
}

function openCalendarEventPopout(event: CalendarEventView): void {
  const graphEventId = event.graphEventId
  if (!graphEventId) return
  void openCalendarPreviewOsPopout(
    { focus: 'event', accountId: event.accountId, graphEventId },
    calendarEventPopoutTitle(event)
  )
}

function openCloudTaskPopout(
  accountId: string,
  listId: string,
  taskId: string,
  title: string
): void {
  void openCalendarPreviewOsPopout(
    { focus: 'task', accountId, listId, taskId },
    title.trim() || 'Aufgabe'
  )
}

export function focusContextPreviewWorkItem(item: WorkItem): boolean {
  if (!isCustomViewContextPreviewActive()) return false

  if (customViewHasAnyPanel(CONTEXT_PREVIEW_PANELS)) {
    useLayoutStudioPreviewStore.getState().applyWorkItem(item)
    return true
  }

  if (item.kind === 'mail_todo') {
    openMailReadingPopout(item.messageId)
    return true
  }
  if (item.kind === 'calendar_event') {
    openCalendarEventPopout(item.event)
    return true
  }
  if (item.kind === 'cloud_task') {
    openCloudTaskPopout(item.accountId, item.listId, item.taskId, item.title)
    return true
  }
  return false
}

export function focusContextPreviewCalendarEvent(event: CalendarEventView): boolean {
  if (!isCustomViewContextPreviewActive()) return false

  if (customViewHasAnyPanel(CONTEXT_PREVIEW_PANELS)) {
    useMailStore.getState().clearSelectedMessage()
    useLayoutStudioPreviewStore.getState().setCalendarEvent(event)
    return true
  }

  openCalendarEventPopout(event)
  return true
}

export async function focusContextPreviewMailMessage(messageId: number): Promise<boolean> {
  if (!isCustomViewContextPreviewActive()) return false

  if (customViewHasAnyPanel(MAIL_PREVIEW_PANELS)) {
    useLayoutStudioPreviewStore.getState().clearContextPreview()
    await useMailStore.getState().openMessageInFolder(messageId)
    return true
  }

  openMailReadingPopout(messageId)
  return true
}

export function focusContextPreviewCloudTask(
  accountId: string,
  listId: string,
  taskId: string,
  title: string,
  task: TaskItemRow,
  listName: string
): boolean {
  if (!isCustomViewContextPreviewActive()) return false

  if (customViewHasAnyPanel(CONTEXT_PREVIEW_PANELS)) {
    useLayoutStudioPreviewStore.getState().applyWorkItem({
      kind: 'cloud_task',
      stableKey: `${accountId}:${listId}:${taskId}`,
      accountId,
      listId,
      taskId,
      listName,
      title,
      dueAtIso: task.dueIso,
      planned: { plannedStartIso: null, plannedEndIso: null },
      completed: task.completed,
      linkedMessageIds: [],
      task
    })
    return true
  }

  openCloudTaskPopout(accountId, listId, taskId, title)
  return true
}

export async function openMailInCustomViewOrModule(
  messageId: number,
  setAppMode: (mode: AppShellMode) => void
): Promise<void> {
  if (await focusContextPreviewMailMessage(messageId)) return
  await useMailStore.getState().openMessageInFolder(messageId)
  setAppMode('mail')
}

export function openCalendarEventInCustomViewOrModule(
  event: CalendarEventView,
  setAppMode: (mode: AppShellMode) => void
): void {
  if (focusContextPreviewCalendarEvent(event)) return
  useCalendarPendingFocusStore.getState().queueFocusEvent(event)
  setAppMode('calendar')
}

export async function openWorkItemInCustomViewOrModule(
  item: WorkItem,
  setAppMode: (mode: AppShellMode) => void
): Promise<void> {
  if (focusContextPreviewWorkItem(item)) return
  if (item.kind === 'mail_todo') {
    await openMailInCustomViewOrModule(item.messageId, setAppMode)
    return
  }
  if (item.kind === 'cloud_task') {
    setAppMode(resolveVisibleAppShellMode('work', ['tasks', 'calendar']))
    return
  }
  openWorkItemInCalendar(item, setAppMode)
}
