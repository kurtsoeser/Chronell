import { ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type {
  EventsOsCalendarDraftInput,
  EventsOsCalendarDraftResult,
  EventsOsInboxKind,
  EventsOsSearchResult,
  EventsOsSendMailResult,
  EventsOsWebinarImportResult,
  EventsOsWritebackInput
} from '../../shared/types/events-os'
import type { ChronellWebinarLaunch } from '../../shared/chronell-protocol'

export const eventsOsApi = {
  ping: (): Promise<{
    ok: boolean
    baseUrl: string
    cacheUpdatedAt?: string | null
    hint?: string | null
    error?: string
  }> => ipcRenderer.invoke(IPC.eventsOs.ping),

  searchEvents: (
    query: string,
    limit = 25
  ): Promise<EventsOsSearchResult> =>
    ipcRenderer.invoke(IPC.eventsOs.searchEvents, { query, limit }),

  sendMail: (input: {
    messageId: number
    eventId: string
    kind?: EventsOsInboxKind
  }): Promise<EventsOsSendMailResult> =>
    ipcRenderer.invoke(IPC.eventsOs.sendMail, input),

  importWebinar: (eventId: string): Promise<EventsOsWebinarImportResult> =>
    ipcRenderer.invoke(IPC.eventsOs.importWebinar, eventId),

  createFromCalendar: (
    input: EventsOsCalendarDraftInput
  ): Promise<EventsOsCalendarDraftResult> =>
    ipcRenderer.invoke(IPC.eventsOs.createFromCalendar, input),

  writeback: (
    input: EventsOsWritebackInput
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.eventsOs.writeback, input),

  drainWebinarLaunches: (): Promise<ChronellWebinarLaunch[]> =>
    ipcRenderer.invoke(IPC.eventsOs.drainWebinarLaunches),

  onWebinarLaunchAvailable: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on('events-os:webinar-launch-available', listener)
    return (): void => {
      ipcRenderer.off('events-os:webinar-launch-available', listener)
    }
  }
}
