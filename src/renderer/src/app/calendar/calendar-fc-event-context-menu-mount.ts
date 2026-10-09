import type { Locale } from 'date-fns'
import type { TFunction } from 'i18next'
import type { CalendarEventView, ConnectedAccount, MailListItem } from '@shared/types'
import type { ContextMenuItem } from '@/components/ContextMenu'
import {
  buildCalendarEventCategorySubmenuItems,
  buildCalendarEventContextItems,
  buildCalendarEventStatusSubmenuItems,
  buildCalendarEventTransferSubmenuItems,
  formatCalendarEventClipboardText
} from '@/lib/calendar-event-context-menu'
import {
  pickAndSendCalendarEventToNotion,
  pickParentAndCreateCalendarEventNotionPage,
  runNotionSendWithErrorHandling
} from '@/lib/notion-ui'
import { respondToCalendarEventInvitation } from '@/lib/calendar-event-rsvp'
import { openExternalUrl } from '@/lib/open-external'
import { showAppConfirm } from '@/stores/app-dialog'
import type { CalendarOverlayContextMenuOptions } from '@/app/calendar/calendar-overlay-context-menu'
import { buildCalendarOverlayContextMenuItems } from '@/app/calendar/calendar-overlay-context-menu'
import type { ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import type { SetCalendarShellEventDialog } from '@/app/calendar/calendar-shell-event-dialog-state'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

export type CalendarFcContextMenuAnchor = {
  x: number
  y: number
  items: ContextMenuItem[]
}

export type CalendarFcGraphEventContextMenuDeps = {
  t: TFunction
  calendarCollatorLocale: string
  isDeCalendar: boolean
  clipboardDfLocale: Locale
  calendarLinkedAccounts: ConnectedAccount[]
  reloadVisibleRange: (opts?: { silent?: boolean; forceRefresh?: boolean }) => void
  setError: (msg: string | null) => void
  setEventDialog: SetCalendarShellEventDialog
  setMailNoteTarget: Dispatch<SetStateAction<Extract<ObjectNoteTarget, { kind: 'mail' }> | null>>
  setEventNoteTarget: Dispatch<SetStateAction<ObjectNoteTarget | null>>
  deleteGraphCalendarEvent: (ev: CalendarEventView) => Promise<void>
  setCalendarFolderContextMenu: Dispatch<SetStateAction<CalendarFcContextMenuAnchor | null>>
  setEventContextMenu: Dispatch<SetStateAction<CalendarFcContextMenuAnchor | null>>
}

type TaggedCtxEl = HTMLElement & { _calCtxMenu?: (ev: MouseEvent) => void }

export function detachCalendarFcContextMenu(el: HTMLElement): void {
  const tagged = el as TaggedCtxEl
  if (tagged._calCtxMenu) {
    el.removeEventListener('contextmenu', tagged._calCtxMenu)
    delete tagged._calCtxMenu
  }
}

export function attachCalendarOverlayContextMenu(
  el: HTMLElement,
  overlay:
    | { kind: 'cloud_task'; task: CloudTaskListItem }
    | { kind: 'mail_todo'; mail: MailListItem },
  opts: {
    setError: (msg: string | null) => void
    setCalendarFolderContextMenu: Dispatch<SetStateAction<CalendarFcContextMenuAnchor | null>>
    setEventContextMenu: Dispatch<SetStateAction<CalendarFcContextMenuAnchor | null>>
    overlayContextMenuOptionsRef: MutableRefObject<CalendarOverlayContextMenuOptions>
  }
): void {
  const onCtx = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    opts.setError(null)
    opts.setCalendarFolderContextMenu(null)
    void (async (): Promise<void> => {
      const anchor = { x: e.clientX, y: e.clientY }
      const items = await buildCalendarOverlayContextMenuItems(
        overlay,
        anchor,
        opts.overlayContextMenuOptionsRef.current
      )
      opts.setEventContextMenu({ x: anchor.x, y: anchor.y, items })
    })()
  }
  el.addEventListener('contextmenu', onCtx)
  const tagged = el as TaggedCtxEl
  tagged._calCtxMenu = onCtx
}

export function attachGraphCalendarEventContextMenu(
  el: HTMLElement,
  calEv: CalendarEventView,
  deps: CalendarFcGraphEventContextMenuDeps
): void {
  const onCtx = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    deps.setError(null)
    void (async (): Promise<void> => {
      const cat = await buildCalendarEventCategorySubmenuItems(
        calEv,
        deps.reloadVisibleRange,
        deps.t,
        deps.calendarCollatorLocale
      )
      const statusMenu = buildCalendarEventStatusSubmenuItems(calEv, deps.reloadVisibleRange, deps.t)
      const copyTo = await buildCalendarEventTransferSubmenuItems(
        calEv,
        'copy',
        deps.calendarLinkedAccounts,
        deps.reloadVisibleRange,
        deps.t,
        deps.calendarCollatorLocale
      )
      const moveTo = await buildCalendarEventTransferSubmenuItems(
        calEv,
        'move',
        deps.calendarLinkedAccounts,
        deps.reloadVisibleRange,
        deps.t,
        deps.calendarCollatorLocale
      )
      const hasGraphEvent = Boolean(calEv.graphEventId?.trim())
      const canMutateEvent =
        calEv.calendarCanEdit !== false &&
        hasGraphEvent &&
        (calEv.source === 'microsoft' || calEv.source === 'google')
      const canCopyToOtherCalendar =
        hasGraphEvent &&
        copyTo.length > 0 &&
        (calEv.source === 'microsoft' || calEv.source === 'google')
      const canMoveToOtherCalendar = canMutateEvent && moveTo.length > 0
      const items = buildCalendarEventContextItems(
        calEv,
        canMutateEvent,
        canCopyToOtherCalendar,
        canMoveToOtherCalendar,
        deps.calendarLinkedAccounts.length > 0,
        {
          onEdit: (): void => {
            deps.setError(null)
            deps.setEventDialog({ mode: 'edit', event: calEv })
          },
          onDuplicate: (): void => {
            const titleTrim = calEv.title?.trim()
            deps.setError(null)
            deps.setEventDialog({
              mode: 'create',
              range: {
                start: new Date(calEv.startIso),
                end: new Date(calEv.endIso),
                allDay: calEv.isAllDay
              },
              createPrefill: {
                subject: titleTrim
                  ? `${titleTrim}${deps.t('calendar.context.duplicateSuffix')}`
                  : deps.t('calendar.context.duplicateEmptyTitle'),
                location: calEv.location ?? ''
              },
              createAccountId: calEv.accountId
            })
          },
          onOpenNote: (): void => {
            const eventRemoteId = calEv.graphEventId?.trim()
            if (!eventRemoteId) return
            deps.setError(null)
            deps.setMailNoteTarget(null)
            deps.setEventNoteTarget({
              kind: 'calendar',
              accountId: calEv.accountId,
              calendarSource: calEv.source,
              calendarRemoteId: calEv.graphCalendarId?.trim() || 'default',
              eventRemoteId,
              title: calEv.title,
              eventTitleSnapshot: calEv.title,
              eventStartIsoSnapshot: calEv.startIso
            })
          },
          onSendToNotion: (): void => {
            void runNotionSendWithErrorHandling(() =>
              pickAndSendCalendarEventToNotion(calEv, deps.isDeCalendar ? 'de' : 'en')
            )
          },
          onSendToNotionAsNewPage: (): void => {
            void runNotionSendWithErrorHandling(() =>
              pickParentAndCreateCalendarEventNotionPage(calEv, deps.isDeCalendar ? 'de' : 'en')
            )
          },
          onCopyDetails: (): void => {
            const text = formatCalendarEventClipboardText(
              calEv,
              deps.t,
              deps.clipboardDfLocale,
              deps.isDeCalendar
            )
            if (!navigator.clipboard?.writeText) {
              deps.setError(deps.t('calendar.errors.clipboardUnsupported'))
              return
            }
            void navigator.clipboard.writeText(text).catch(() => {
              deps.setError(deps.t('calendar.errors.clipboardWriteFailed'))
            })
          },
          onCopyWebLink: (): void => {
            const u = calEv.webLink?.trim()
            if (!u) return
            if (!navigator.clipboard?.writeText) {
              deps.setError(deps.t('calendar.errors.clipboardUnsupported'))
              return
            }
            void navigator.clipboard.writeText(u).catch(() => {
              deps.setError(deps.t('calendar.errors.clipboardWriteFailed'))
            })
          },
          onCopyJoinUrl: (): void => {
            const u = calEv.joinUrl?.trim()
            if (!u) return
            if (!navigator.clipboard?.writeText) {
              deps.setError(deps.t('calendar.errors.clipboardUnsupported'))
              return
            }
            void navigator.clipboard.writeText(u).catch(() => {
              deps.setError(deps.t('calendar.errors.clipboardWriteFailed'))
            })
          },
          onOpenWeb: (): void => {
            const u = calEv.webLink?.trim()
            if (u) {
              void openExternalUrl(u).catch((err) => {
                deps.setError(err instanceof Error ? err.message : String(err))
              })
            }
          },
          onOpenTeams: (): void => {
            const u = calEv.joinUrl?.trim()
            if (u) {
              void openExternalUrl(u).catch((err) => {
                deps.setError(err instanceof Error ? err.message : String(err))
              })
            }
          },
          onAcceptInvitation: (): void => {
            void (async (): Promise<void> => {
              deps.setError(null)
              const res = await respondToCalendarEventInvitation(calEv, 'accept', { t: deps.t })
              if (res?.ok) deps.reloadVisibleRange()
            })()
          },
          onTentativeInvitation: (): void => {
            void (async (): Promise<void> => {
              deps.setError(null)
              const res = await respondToCalendarEventInvitation(calEv, 'tentative', { t: deps.t })
              if (res?.ok) deps.reloadVisibleRange()
            })()
          },
          onDeclineInvitation: (): void => {
            void (async (): Promise<void> => {
              deps.setError(null)
              const res = await respondToCalendarEventInvitation(calEv, 'decline', { t: deps.t })
              if (res?.ok) deps.reloadVisibleRange()
            })()
          },
          onDelete: (): void => {
            const gid = calEv.graphEventId
            if (!gid) return
            void (async (): Promise<void> => {
              const ok = await showAppConfirm(deps.t('calendar.confirm.deleteEventBody'), {
                title: deps.t('calendar.confirm.deleteEventTitle'),
                variant: 'danger',
                confirmLabel: deps.t('calendar.confirm.deleteEventConfirm')
              })
              if (!ok) return
              try {
                deps.setError(null)
                await deps.deleteGraphCalendarEvent(calEv)
              } catch (err) {
                deps.setError(err instanceof Error ? err.message : String(err))
              }
            })()
          }
        },
        deps.t,
        {
          categorySubmenu: cat.length > 0 ? cat : undefined,
          statusSubmenu: statusMenu.length > 0 ? statusMenu : undefined,
          copyToSubmenu: copyTo.length > 0 ? copyTo : undefined,
          moveToSubmenu: moveTo.length > 0 ? moveTo : undefined
        }
      )
      deps.setCalendarFolderContextMenu(null)
      deps.setEventContextMenu({ x: e.clientX, y: e.clientY, items })
    })()
  }
  el.addEventListener('contextmenu', onCtx)
  const tagged = el as TaggedCtxEl
  tagged._calCtxMenu = onCtx
}
