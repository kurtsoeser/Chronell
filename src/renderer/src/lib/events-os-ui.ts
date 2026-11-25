import i18n from 'i18next'
import type { CalendarEventView } from '@shared/types'
import type { MailContextHandlers } from '@/lib/mail-context-menu'
import { openExternalUrl } from '@/lib/open-external'
import { showAppAlert, showAppChoice } from '@/stores/app-dialog'
import { pickEventsOsDestination } from '@/stores/events-os-destination-picker'

/** Fortbildungs-/Kurscode aus Betreff (Renderer-Spiegel der Main-Heuristik). */
export function suggestEventsOsSearchQuery(subject?: string | null): string {
  const s = String(subject || '').trim()
  if (!s) return ''
  const code = s.match(/\b(\d{2}[A-Z0-9]{6,})\b/i)
  if (code) return code[1]
  return s
    .replace(/^(abmeldung|anmeldung|storno|absage)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

async function runEventsOsWithErrorHandling(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await showAppAlert(i18n.t('eventsOs.sendFailed', { message }), {
      title: i18n.t('eventsOs.title')
    })
  }
}

export async function pickAndSendMailToEventsOs(
  messageId: number,
  subject?: string | null
): Promise<void> {
  const pick = await pickEventsOsDestination({
    messageId,
    suggestedQuery: suggestEventsOsSearchQuery(subject),
    subject: subject ?? undefined
  })
  if (!pick) return

  const result = await window.mailClient.eventsOs.sendMail({
    messageId,
    eventId: pick.eventId,
    kind: pick.kind
  })

  const personLine = result.participant?.name
    ? `\n${i18n.t('eventsOs.personLine', {
        name: result.participant.name,
        email: result.participant.email || '—'
      })}`
    : result.person?.name
      ? `\n${i18n.t('eventsOs.personLine', {
          name: result.person.name,
          email: result.person.email || '—'
        })}`
      : ''

  const attachmentCount = result.attachmentCount ?? 0
  const attachmentLine =
    attachmentCount > 0
      ? `\n${i18n.t('eventsOs.attachmentsLine', { count: attachmentCount })}`
      : ''
  const skipped = result.attachmentsSkipped?.filter(Boolean) ?? []
  const skippedLine =
    skipped.length > 0
      ? `\n${i18n.t('eventsOs.attachmentsSkippedLine', {
          detail: skipped.slice(0, 3).join('; ')
        })}`
      : ''

  const openUrl =
    attachmentCount > 0 && result.studioAblageUrl
      ? result.studioAblageUrl
      : result.studioAkteUrl || result.studioAblageUrl
  const openLabel =
    attachmentCount > 0 && result.studioAblageUrl
      ? i18n.t('eventsOs.openAblage')
      : i18n.t('eventsOs.openAkte')

  const choice = await showAppChoice(
    `${result.message || i18n.t('eventsOs.sendSuccess')}\n\n${pick.title}${personLine}${attachmentLine}${skippedLine}`,
    {
      title: i18n.t('eventsOs.title'),
      cancelLabel: i18n.t('common.close'),
      actions: openUrl
        ? [
            {
              id: 'open',
              label: openLabel,
              variant: 'primary'
            }
          ]
        : []
    }
  )
  if (choice === 'open' && openUrl) {
    void openExternalUrl(openUrl)
  }
}

export async function sendCalendarEventToEventsOs(ev: CalendarEventView): Promise<void> {
  try {
    const graphEventId = ev.graphEventId?.trim()
    if (!graphEventId) {
      await showAppAlert(i18n.t('eventsOs.calendarMissingId'), {
        title: i18n.t('eventsOs.title')
      })
      return
    }

    const result = await window.mailClient.eventsOs.createFromCalendar({
      graphEventId,
      subject: ev.title?.trim() || i18n.t('calendar.eventPreview.noTitle'),
      startIso: ev.startIso,
      endIso: ev.endIso,
      isAllDay: ev.isAllDay,
      joinUrl: ev.joinUrl,
      webLink: ev.webLink,
      location: ev.location,
      categories: ev.categories || []
    })

    const headline = result.created
      ? i18n.t('eventsOs.calendarCreated', { title: result.title })
      : i18n.t('eventsOs.calendarUpdated', { title: result.title })

    const choice = await showAppChoice(headline, {
      title: i18n.t('eventsOs.title'),
      cancelLabel: i18n.t('common.close'),
      actions: result.studioAkteUrl
        ? [
            {
              id: 'open',
              label: i18n.t('eventsOs.openAkte'),
              variant: 'primary'
            }
          ]
        : []
    })
    if (choice === 'open' && result.studioAkteUrl) {
      void openExternalUrl(result.studioAkteUrl)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await showAppAlert(i18n.t('eventsOs.sendFailed', { message }), {
      title: i18n.t('eventsOs.title')
    })
  }
}

export function createMailSendToEventsOsHandler(): NonNullable<
  MailContextHandlers['sendToEventsOs']
> {
  return (msg): void => {
    void runEventsOsWithErrorHandling(() =>
      pickAndSendMailToEventsOs(msg.id, msg.subject)
    )
  }
}
