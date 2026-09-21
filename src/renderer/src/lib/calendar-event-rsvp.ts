import type { TFunction } from 'i18next'
import type {
  CalendarEventRsvpKind,
  CalendarEventRsvpScope,
  CalendarEventView,
  CalendarGetEventResult,
  CalendarRespondToEventResult
} from '@shared/types'
import { showAppAlert, showAppChoice, showAppConfirm } from '@/stores/app-dialog'
import { useUndoStore } from '@/stores/undo'

/** Fremde Microsoft-Einladung (Organisator ≠ eigenes Konto). */
export function calendarEventLooksLikeExternalInvitation(
  ev: Pick<CalendarEventView, 'source' | 'organizer' | 'accountEmail'>
): boolean {
  if (ev.source !== 'microsoft') return false
  const org = ev.organizer?.trim().toLowerCase() ?? ''
  const self = ev.accountEmail?.trim().toLowerCase() ?? ''
  if (!org || !self) return false
  return org !== self
}

export function calendarEventIsSeriesInvitation(
  detail: Pick<CalendarGetEventResult, 'eventType' | 'seriesMasterId'> | null | undefined
): boolean {
  if (!detail) return false
  const type = detail.eventType
  if (type === 'occurrence' || type === 'exception' || type === 'seriesMaster') return true
  return Boolean(detail.seriesMasterId?.trim())
}

export function calendarEventCanRespondAsAttendee(
  ev: Pick<CalendarEventView, 'source' | 'organizer' | 'accountEmail' | 'graphEventId'>,
  detail?: Pick<CalendarGetEventResult, 'isOrganizer'> | null
): boolean {
  if (ev.source !== 'microsoft' || !ev.graphEventId?.trim()) return false
  if (detail?.isOrganizer === true) return false
  if (detail?.isOrganizer === false) return true
  return calendarEventLooksLikeExternalInvitation(ev)
}

async function chooseRsvpScope(
  t: TFunction,
  response: CalendarEventRsvpKind,
  isSeries: boolean
): Promise<CalendarEventRsvpScope | null> {
  if (!isSeries) return 'this'
  const title =
    response === 'decline'
      ? t('calendar.eventRsvp.declineScopeTitle')
      : response === 'accept'
        ? t('calendar.eventRsvp.acceptScopeTitle')
        : t('calendar.eventRsvp.tentativeScopeTitle')
  const message =
    response === 'decline'
      ? t('calendar.eventRsvp.declineScopeBody')
      : response === 'accept'
        ? t('calendar.eventRsvp.acceptScopeBody')
        : t('calendar.eventRsvp.tentativeScopeBody')
  const choice = await showAppChoice(message, {
    title,
    cancelLabel: t('common.cancel'),
    actions: [
      {
        id: 'this',
        label: t('calendar.eventRsvp.scopeThis'),
        variant: response === 'decline' ? 'default' : 'primary'
      },
      {
        id: 'series',
        label: t('calendar.eventRsvp.scopeSeries'),
        variant: response === 'decline' ? 'default' : 'secondary'
      }
    ]
  })
  if (choice === 'this' || choice === 'series') return choice
  return null
}

export async function respondToCalendarEventInvitation(
  ev: CalendarEventView,
  response: CalendarEventRsvpKind,
  opts: {
    t: TFunction
    detail?: CalendarGetEventResult | null
    comment?: string | null
    sendResponse?: boolean
    /** Wenn gesetzt: Scope nicht abfragen. */
    scope?: CalendarEventRsvpScope
  }
): Promise<CalendarRespondToEventResult | null> {
  const graphEventId = ev.graphEventId?.trim()
  if (!graphEventId || ev.source !== 'microsoft') {
    await showAppAlert(opts.t('calendar.eventRsvp.microsoftOnly'), {
      title: opts.t('calendar.eventRsvp.failedTitle')
    })
    return null
  }

  let detail = opts.detail ?? null
  if (!detail) {
    try {
      detail = await window.mailClient.calendar.getEvent({
        accountId: ev.accountId,
        graphEventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        forceRefresh: true
      })
    } catch {
      detail = null
    }
  }

  if (detail?.isOrganizer === true) {
    await showAppAlert(opts.t('calendar.eventRsvp.organizerCannotRespond'), {
      title: opts.t('calendar.eventRsvp.failedTitle')
    })
    return null
  }

  let scope = opts.scope
  if (!scope) {
    const isSeries = calendarEventIsSeriesInvitation(detail)
    if (isSeries) {
      const chosen = await chooseRsvpScope(opts.t, response, true)
      if (!chosen) return null
      scope = chosen
    } else {
      if (response === 'decline') {
        const ok = await showAppConfirm(opts.t('calendar.eventRsvp.declineConfirmBody'), {
          title: opts.t('calendar.eventRsvp.declineConfirmTitle'),
          confirmLabel: opts.t('calendar.eventRsvp.decline'),
          variant: 'danger'
        })
        if (!ok) return null
      }
      scope = 'this'
    }
  }

  const result = await window.mailClient.calendar.respondToEvent({
    accountId: ev.accountId,
    graphEventId,
    graphCalendarId: ev.graphCalendarId ?? null,
    response,
    scope,
    comment: opts.comment ?? null,
    sendResponse: opts.sendResponse !== false
  })

  if (!result.ok) {
    await showAppAlert(result.error ?? opts.t('calendar.eventRsvp.failed'), {
      title: opts.t('calendar.eventRsvp.failedTitle')
    })
    return result
  }

  if (result.removedWithoutResponse && response === 'decline') {
    useUndoStore.getState().pushToast({
      label: opts.t('calendar.eventRsvp.removedWithoutResponse'),
      variant: 'success',
      durationMs: 5000
    })
  }

  void window.mailClient.calendar.syncAccount(ev.accountId).catch(() => {})
  return result
}
