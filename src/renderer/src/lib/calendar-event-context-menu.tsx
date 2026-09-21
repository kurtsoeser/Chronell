import type { Locale } from 'date-fns'
import type { TFunction } from 'i18next'
import {
  ArrowRightLeft,
  Check,
  CircleDot,
  Copy,
  ExternalLink,
  Files,
  HelpCircle,
  Lock,
  Pencil,
  SquareArrowOutUpRight,
  StickyNote,
  Tag,
  Trash2,
  Video,
  X
} from 'lucide-react'
import type { CalendarEventShowAs, CalendarEventView, CalendarGraphCalendarRow, ConnectedAccount } from '@shared/types'
import {
  CALENDAR_EVENT_SHOW_AS_OPTIONS,
  calendarEventSensitivityFromPrivate,
  calendarEventSensitivityIsPrivate,
  DEFAULT_CALENDAR_EVENT_SHOW_AS
} from '@shared/calendar-event-status'
import {
  calendarDestinationKey,
  destinationAccountOptgroupLabel,
  isWritableCalendarTarget,
  parseCalendarDestinationKey
} from '@/app/calendar/calendar-create-destination'
import { formatCalendarEventClipboardText as formatCalendarEventClipboardTextShared } from '@shared/calendar-event-clipboard'
import type { ContextMenuItem } from '@/components/ContextMenu'
import { showAppAlert } from '@/stores/app-dialog'
import { calendarEventLooksLikeExternalInvitation } from '@/lib/calendar-event-rsvp'

export function formatCalendarEventClipboardText(
  ev: CalendarEventView,
  t: TFunction,
  locale: Locale,
  isDe: boolean
): string {
  return formatCalendarEventClipboardTextShared(
    ev,
    {
      noTitle: t('calendar.eventPreview.noTitle'),
      allDayPrefix: t('calendar.eventClipboard.allDayPrefix'),
      location: t('calendar.eventClipboard.location'),
      organizer: t('calendar.eventClipboard.organizer'),
      teams: t('calendar.eventClipboard.teams'),
      link: t('calendar.eventClipboard.link')
    },
    locale,
    isDe
  )
}

export interface CalendarEventContextHandlers {
  onEdit: () => void
  onDuplicate: () => void
  onOpenNote: () => void
  onSendToNotion?: () => void
  onSendToNotionAsNewPage?: () => void
  onCopyDetails: () => void
  onCopyWebLink: () => void
  onCopyJoinUrl: () => void
  onOpenWeb: () => void
  onOpenTeams: () => void
  onDelete: () => void
  onAcceptInvitation?: () => void
  onTentativeInvitation?: () => void
  onDeclineInvitation?: () => void
}

export interface CalendarEventContextMenuExtra {
  categorySubmenu?: ContextMenuItem[]
  statusSubmenu?: ContextMenuItem[]
  copyToSubmenu?: ContextMenuItem[]
  moveToSubmenu?: ContextMenuItem[]
}

function isCurrentEventDestination(
  ev: CalendarEventView,
  accountId: string,
  graphCalendarId: string
): boolean {
  return (
    ev.accountId === accountId &&
    (ev.graphCalendarId?.trim() ?? '') === graphCalendarId.trim()
  )
}

async function runCalendarTransfer(
  ev: CalendarEventView,
  mode: 'copy' | 'move',
  accountId: string,
  graphCalendarId: string,
  onAfterChange: () => void | Promise<void>,
  t: TFunction
): Promise<void> {
  const parsed = parseCalendarDestinationKey(calendarDestinationKey(accountId, graphCalendarId))
  if (!parsed || !ev.graphEventId?.trim()) return
  try {
    await window.mailClient.calendar.transferEvent({
      source: {
        accountId: ev.accountId,
        graphEventId: ev.graphEventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        title: ev.title,
        startIso: ev.startIso,
        endIso: ev.endIso,
        isAllDay: ev.isAllDay,
        location: ev.location ?? null,
        categories: ev.categories ?? null,
        calendarCanEdit: ev.calendarCanEdit
      },
      targetAccountId: parsed.accountId,
      targetGraphCalendarId: parsed.graphCalendarId,
      mode
    })
    await onAfterChange()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await showAppAlert(message, {
      title:
        mode === 'copy'
          ? t('calendar.eventContextMenu.copyFailedTitle')
          : t('calendar.eventContextMenu.moveFailedTitle')
    })
  }
}

function calendarTargetItemsForAccount(
  ev: CalendarEventView,
  mode: 'copy' | 'move',
  account: ConnectedAccount,
  calendars: CalendarGraphCalendarRow[],
  onAfterChange: () => void | Promise<void>,
  t: TFunction
): ContextMenuItem[] {
  const rows =
    calendars.length > 0
      ? calendars.filter(isWritableCalendarTarget)
      : [{ id: '', name: t('calendar.eventDialog.primaryCalendarStandard'), isDefaultCalendar: true }]

  const items: ContextMenuItem[] = []
  for (const cal of rows) {
    const calId = cal.id?.trim() ?? ''
    if (isCurrentEventDestination(ev, account.id, calId)) continue
    const calName = cal.name?.trim() || t('calendar.eventDialog.primaryCalendarStandard')
    const suffix = cal.isDefaultCalendar ? t('calendar.eventDialog.standardCalendarSuffix') : ''
    items.push({
      id: `cal-xfer-${mode}-${account.id}-${calId || 'default'}`,
      label: `${calName}${suffix}`,
      onSelect: (): void => {
        void runCalendarTransfer(ev, mode, account.id, calId, onAfterChange, t)
      }
    })
  }
  return items
}

export async function buildCalendarEventTransferSubmenuItems(
  ev: CalendarEventView,
  mode: 'copy' | 'move',
  calendarAccounts: ConnectedAccount[],
  onAfterChange: () => void | Promise<void>,
  t: TFunction,
  collatorLocale: string
): Promise<ContextMenuItem[]> {
  if (!ev.graphEventId?.trim()) return []
  if (mode === 'move' && ev.calendarCanEdit === false) return []

  const bundles = await Promise.all(
    calendarAccounts.map((account) =>
      window.mailClient.calendar
        .listCalendars({ accountId: account.id })
        .then((calendars) => ({ account, calendars }))
        .catch(() => ({ account, calendars: [] as CalendarGraphCalendarRow[] }))
    )
  )

  const accountMenus: ContextMenuItem[] = []
  for (const { account, calendars } of bundles) {
    const submenu = calendarTargetItemsForAccount(ev, mode, account, calendars, onAfterChange, t)
    if (submenu.length === 0) continue
    accountMenus.push({
      id: `cal-xfer-${mode}-acc-${account.id}`,
      label: destinationAccountOptgroupLabel(account),
      submenu
    })
  }

  accountMenus.sort((a, b) => a.label.localeCompare(b.label, collatorLocale))
  if (accountMenus.length === 0) {
    return [{ id: `cal-xfer-${mode}-empty`, label: t('calendar.eventContextMenu.transferEmpty'), disabled: true }]
  }
  return accountMenus
}

export async function buildCalendarEventCategorySubmenuItems(
  ev: CalendarEventView,
  onAfterChange: () => void | Promise<void>,
  t: TFunction,
  collatorLocale: string
): Promise<ContextMenuItem[]> {
  if (ev.source !== 'microsoft' || !ev.graphEventId?.trim()) return []
  try {
    const masters = await window.mailClient.mail.listMasterCategories(ev.accountId)
    const names = [...new Set([...masters.map((m) => m.displayName), ...(ev.categories ?? [])])].sort((a, b) =>
      a.localeCompare(b, collatorLocale)
    )
    if (names.length === 0) return []

    return names.map((name, i) => {
      const on = (ev.categories ?? []).includes(name)
      const label = (on ? '\u2713 ' : '   ') + name
      return {
        id: `cal-cat-${i}`,
        label,
        onSelect: (): void => {
          void (async (): Promise<void> => {
            const next = new Set(ev.categories ?? [])
            if (next.has(name)) next.delete(name)
            else next.add(name)
            await window.mailClient.calendar.patchEventCategories({
              accountId: ev.accountId,
              graphEventId: ev.graphEventId!,
              graphCalendarId: ev.graphCalendarId ?? null,
              categories: Array.from(next).sort((a, b) => a.localeCompare(b, collatorLocale))
            })
            await onAfterChange()
          })()
        }
      }
    })
  } catch {
    return [{ id: 'cal-cat-err', label: t('calendar.eventContextMenu.categoriesLoadError'), disabled: true }]
  }
}

function showAsIcon(showAs: CalendarEventShowAs): ContextMenuItem['icon'] {
  switch (showAs) {
    case 'tentative':
      return HelpCircle
    case 'workingElsewhere':
      return ExternalLink
    case 'free':
    case 'busy':
    case 'oof':
    default:
      return CircleDot
  }
}

export function buildCalendarEventStatusSubmenuItems(
  ev: CalendarEventView,
  onAfterChange: () => void | Promise<void>,
  t: TFunction
): ContextMenuItem[] {
  if (!ev.graphEventId?.trim()) return []
  if (ev.source !== 'microsoft' && ev.source !== 'google') return []
  if (ev.calendarCanEdit === false) return []

  const currentShowAs = ev.showAs ?? DEFAULT_CALENDAR_EVENT_SHOW_AS
  const isPrivate = calendarEventSensitivityIsPrivate(ev.sensitivity)

  const patchStatus = (patch: {
    showAs?: CalendarEventShowAs
    sensitivity?: ReturnType<typeof calendarEventSensitivityFromPrivate>
  }): void => {
    void (async (): Promise<void> => {
      try {
        await window.mailClient.calendar.patchEventStatus({
          accountId: ev.accountId,
          graphEventId: ev.graphEventId!,
          graphCalendarId: ev.graphCalendarId ?? null,
          ...patch
        })
        await onAfterChange()
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        await showAppAlert(message, {
          title: t('calendar.eventContextMenu.statusFailedTitle')
        })
      }
    })()
  }

  const showAsItems: ContextMenuItem[] = CALENDAR_EVENT_SHOW_AS_OPTIONS.map((opt) => ({
    id: `cal-status-showas-${opt}`,
    label: t(`calendar.eventDialog.statusShowAs.${opt}`),
    icon: showAsIcon(opt),
    selected: currentShowAs === opt,
    onSelect: (): void => {
      if (currentShowAs === opt) return
      patchStatus({ showAs: opt })
    }
  }))

  return [
    ...showAsItems,
    { id: 'cal-status-sep-private', label: '', separator: true },
    {
      id: 'cal-status-private',
      label: t('calendar.eventDialog.statusPrivate'),
      icon: Lock,
      selected: isPrivate,
      onSelect: (): void => {
        patchStatus({ sensitivity: calendarEventSensitivityFromPrivate(!isPrivate) })
      }
    }
  ]
}

export function buildCalendarEventContextItems(
  ev: CalendarEventView,
  canMutateEvent: boolean,
  canCopyToOtherCalendar: boolean,
  canMoveToOtherCalendar: boolean,
  canDuplicate: boolean,
  h: CalendarEventContextHandlers,
  t: TFunction,
  extra?: CalendarEventContextMenuExtra
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      id: 'edit',
      label: t('calendar.eventContextMenu.edit'),
      icon: Pencil,
      disabled: !canMutateEvent,
      onSelect: h.onEdit
    },
    {
      id: 'dup',
      label: t('calendar.eventContextMenu.duplicate'),
      icon: Files,
      disabled: !canDuplicate,
      onSelect: h.onDuplicate
    },
    ...(extra?.copyToSubmenu && extra.copyToSubmenu.length > 0
      ? [
          {
            id: 'copy-to',
            label: t('calendar.eventContextMenu.copyTo'),
            icon: Copy,
            disabled: !canCopyToOtherCalendar,
            submenu: extra.copyToSubmenu
          }
        ]
      : []),
    ...(extra?.moveToSubmenu && extra.moveToSubmenu.length > 0
      ? [
          {
            id: 'move-to',
            label: t('calendar.eventContextMenu.moveTo'),
            icon: ArrowRightLeft,
            disabled: !canMoveToOtherCalendar,
            submenu: extra.moveToSubmenu
          }
        ]
      : []),
    {
      id: 'note',
      label: t('notes.contextNew'),
      icon: StickyNote,
      disabled: !ev.graphEventId?.trim(),
      onSelect: h.onOpenNote
    },
    ...(h.onSendToNotion || h.onSendToNotionAsNewPage
      ? [
          ...(h.onSendToNotion
            ? [
                {
                  id: 'notion',
                  label: t('notion.contextSend'),
                  icon: SquareArrowOutUpRight,
                  onSelect: h.onSendToNotion
                }
              ]
            : []),
          ...(h.onSendToNotionAsNewPage
            ? [
                {
                  id: 'notion-new-page',
                  label: t('notion.contextSendEventAsNewPage'),
                  icon: SquareArrowOutUpRight,
                  onSelect: h.onSendToNotionAsNewPage
                }
              ]
            : []),
        ]
      : []),
    ...(extra?.categorySubmenu && extra.categorySubmenu.length > 0
      ? [
          { id: 'sep-cat', label: '', separator: true },
          {
            id: 'cal-categories',
            label: t('calendar.eventContextMenu.categories'),
            icon: Tag,
            submenu: extra.categorySubmenu
          }
        ]
      : []),
    ...(extra?.statusSubmenu && extra.statusSubmenu.length > 0
      ? [
          ...(extra?.categorySubmenu && extra.categorySubmenu.length > 0
            ? []
            : [{ id: 'sep-status', label: '', separator: true }]),
          {
            id: 'cal-status',
            label: t('calendar.eventContextMenu.status'),
            icon: CircleDot,
            disabled: !canMutateEvent,
            submenu: extra.statusSubmenu
          }
        ]
      : []),
    { id: 'sep1', label: '', separator: true },
    {
      id: 'copy',
      label: t('calendar.eventContextMenu.copyDetails'),
      icon: Copy,
      onSelect: h.onCopyDetails
    }
  ]

  const linkCopies: ContextMenuItem[] = []
  if (ev.webLink?.trim()) {
    linkCopies.push({
      id: 'copyWeb',
      label: t('calendar.eventContextMenu.copyOutlookWebLink'),
      icon: Copy,
      onSelect: h.onCopyWebLink
    })
  }
  if (ev.joinUrl?.trim() && ev.joinUrl.trim() !== ev.webLink?.trim()) {
    linkCopies.push({
      id: 'copyJoin',
      label: t('calendar.eventContextMenu.copyTeamsMeetingLink'),
      icon: Copy,
      onSelect: h.onCopyJoinUrl
    })
  }
  items.push(...linkCopies)

  const openers: ContextMenuItem[] = []
  if (ev.webLink?.trim()) {
    openers.push({
      id: 'openWeb',
      label: t('calendar.eventContextMenu.openInBrowser'),
      icon: ExternalLink,
      onSelect: h.onOpenWeb
    })
  }
  if (ev.joinUrl?.trim()) {
    openers.push({
      id: 'openTeams',
      label: t('calendar.eventContextMenu.openTeamsMeeting'),
      icon: Video,
      onSelect: h.onOpenTeams
    })
  }
  if (openers.length > 0) {
    items.push({ id: 'sep2', label: '', separator: true }, ...openers)
  }

  const canRespond =
    calendarEventLooksLikeExternalInvitation(ev) &&
    Boolean(ev.graphEventId?.trim()) &&
    (h.onAcceptInvitation || h.onTentativeInvitation || h.onDeclineInvitation)
  if (canRespond) {
    items.push({ id: 'sep-rsvp', label: '', separator: true })
    if (h.onAcceptInvitation) {
      items.push({
        id: 'rsvp-accept',
        label: t('calendar.eventRsvp.accept'),
        icon: Check,
        onSelect: h.onAcceptInvitation
      })
    }
    if (h.onTentativeInvitation) {
      items.push({
        id: 'rsvp-tentative',
        label: t('calendar.eventRsvp.tentative'),
        icon: HelpCircle,
        onSelect: h.onTentativeInvitation
      })
    }
    if (h.onDeclineInvitation) {
      items.push({
        id: 'rsvp-decline',
        label: t('calendar.eventRsvp.decline'),
        icon: X,
        destructive: true,
        onSelect: h.onDeclineInvitation
      })
    }
  }

  items.push({ id: 'sep3', label: '', separator: true })
  items.push({
    id: 'delete',
    label: t('calendar.eventContextMenu.delete'),
    icon: Trash2,
    destructive: true,
    disabled: !canMutateEvent,
    onSelect: h.onDelete
  })

  return items
}
