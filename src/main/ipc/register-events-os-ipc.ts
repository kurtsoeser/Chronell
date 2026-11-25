import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type {
  EventsOsCalendarDraftInput,
  EventsOsInboxKind,
  EventsOsWritebackInput
} from '../../shared/types/events-os'
import { drainChronellWebinarLaunches } from '../chronell-protocol-queue'
import { importEventsOsEventForWebinar } from '../events-os/import-webinar'
import {
  EVENTS_OS_STUDIO_BASE,
  postCalendarDraftToEventsOs,
  postEventsOsWriteback,
  searchEventsOsEvents
} from '../events-os/studio-client'
import { sendMailToEventsOs } from '../events-os/send-mail-to-events-os'

export function registerEventsOsIpc(): void {
  ipcMain.handle(IPC.eventsOs.ping, async () => {
    try {
      const res = await searchEventsOsEvents('', 1)
      return {
        ok: true,
        baseUrl: EVENTS_OS_STUDIO_BASE,
        cacheUpdatedAt: res.cacheUpdatedAt,
        hint: res.hint || null
      }
    } catch (err) {
      return {
        ok: false,
        baseUrl: EVENTS_OS_STUDIO_BASE,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  })

  ipcMain.handle(
    IPC.eventsOs.searchEvents,
    async (_event, input: { query?: string; limit?: number }) => {
      return searchEventsOsEvents(
        String(input?.query || ''),
        Number(input?.limit) || 25
      )
    }
  )

  ipcMain.handle(
    IPC.eventsOs.sendMail,
    async (
      _event,
      input: {
        messageId?: number
        eventId?: string
        kind?: EventsOsInboxKind
      }
    ) => {
      const messageId = Number(input?.messageId)
      const eventId = String(input?.eventId || '').trim()
      if (!Number.isFinite(messageId) || messageId <= 0) {
        throw new Error('messageId fehlt')
      }
      if (!eventId) throw new Error('eventId fehlt')
      return sendMailToEventsOs({
        messageId,
        eventId,
        kind: input?.kind
      })
    }
  )

  ipcMain.handle(IPC.eventsOs.importWebinar, async (_event, eventId: string) => {
    return importEventsOsEventForWebinar(String(eventId || ''))
  })

  ipcMain.handle(
    IPC.eventsOs.createFromCalendar,
    async (_event, input: EventsOsCalendarDraftInput) => {
      const graphEventId = String(input?.graphEventId || '').trim()
      const subject = String(input?.subject || '').trim()
      const startIso = String(input?.startIso || '').trim()
      const endIso = String(input?.endIso || '').trim()
      if (!graphEventId) throw new Error('graphEventId fehlt')
      if (!subject || !startIso || !endIso) {
        throw new Error('Titel oder Zeitraum des Termins fehlt')
      }
      return postCalendarDraftToEventsOs({
        graphEventId,
        subject,
        startIso,
        endIso,
        isAllDay: Boolean(input?.isAllDay),
        joinUrl: input?.joinUrl || null,
        webLink: input?.webLink || null,
        location: input?.location || null,
        categories: Array.isArray(input?.categories) ? input.categories : []
      })
    }
  )

  ipcMain.handle(IPC.eventsOs.writeback, async (_event, input: EventsOsWritebackInput) => {
    const eventId = String(input?.eventId || '').trim()
    if (!eventId) throw new Error('eventId fehlt')
    return postEventsOsWriteback({ ...input, eventId })
  })

  ipcMain.handle(IPC.eventsOs.drainWebinarLaunches, async () => {
    return drainChronellWebinarLaunches()
  })
}
