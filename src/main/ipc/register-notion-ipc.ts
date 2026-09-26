import { ipcMain } from 'electron'
import {
  IPC,
  type NotionAppendEventInput,
  type NotionAppendMailInput,
  type NotionAppendNoteInput,
  type NotionAppendResult,
  type NotionConnectionStatus,
  type NotionCreateEventPageInput,
  type NotionCreateMailPageInput,
  type NotionCreateNotePageInput,
  type NotionCreatePageInput,
  type NotionCreatePageResult,
  type NotionDestinationsConfig,
  type NotionKurtrocksEventHit,
  type NotionSearchPageHit,
  type NotionSavedDestination,
  type NotionUpdateKurtrocksEventLinksInput,
  type NotionUpdateKurtrocksEventLinksResult,
  type NotionWebinarImportResult
} from '@shared/types'
import {
  addNotionFavorite,
  appendCalendarEventToNotion,
  appendMailToNotion,
  appendNoteToNotion,
  connectNotion,
  connectNotionInternal,
  createCalendarEventAsNotionPage,
  createMailAsNotionPage,
  createNoteAsNotionPage,
  createNotionPage,
  disconnectNotion,
  getNotionConnectionStatus,
  getNotionDestinations,
  removeNotionFavorite,
  searchNotionPages,
  setNotionDestinations
} from '../notion/notion-service'
import {
  importKurtrocksEventForWebinar,
  searchKurtrocksEvents,
  updateKurtrocksEventLinks
} from '../notion/notion-kurtrocks-events'

export function registerNotionIpc(): void {
  ipcMain.handle(IPC.notion.getStatus, async (): Promise<NotionConnectionStatus> => {
    return getNotionConnectionStatus()
  })

  ipcMain.handle(IPC.notion.connect, async (): Promise<NotionConnectionStatus> => {
    return connectNotion()
  })

  ipcMain.handle(
    IPC.notion.connectInternal,
    async (_event, token: string): Promise<NotionConnectionStatus> => {
      return connectNotionInternal(typeof token === 'string' ? token : '')
    }
  )

  ipcMain.handle(IPC.notion.disconnect, async (): Promise<NotionConnectionStatus> => {
    return disconnectNotion()
  })

  ipcMain.handle(
    IPC.notion.searchPages,
    async (_event, query: string): Promise<NotionSearchPageHit[]> => {
      return searchNotionPages(typeof query === 'string' ? query : '')
    }
  )

  ipcMain.handle(IPC.notion.getDestinations, async (): Promise<NotionDestinationsConfig> => {
    return getNotionDestinations()
  })

  ipcMain.handle(
    IPC.notion.setDestinations,
    async (_event, config: NotionDestinationsConfig): Promise<void> => {
      if (!config || typeof config !== 'object') {
        throw new Error('Ungueltige Notion-Ziel-Konfiguration.')
      }
      await setNotionDestinations(config)
    }
  )

  ipcMain.handle(
    IPC.notion.appendMail,
    async (_event, input: NotionAppendMailInput): Promise<NotionAppendResult> => {
      if (!input || typeof input.messageId !== 'number') {
        throw new Error('Notion: messageId fehlt.')
      }
      return appendMailToNotion(input.messageId, input.pageId, input.webLink)
    }
  )

  ipcMain.handle(
    IPC.notion.appendEvent,
    async (_event, input: NotionAppendEventInput): Promise<NotionAppendResult> => {
      if (!input?.event) {
        throw new Error('Notion: Termin fehlt.')
      }
      return appendCalendarEventToNotion(
        input.event,
        input.pageId,
        input.localeCode === 'en' ? 'en' : 'de'
      )
    }
  )

  ipcMain.handle(
    IPC.notion.addFavorite,
    async (_event, hit: NotionSearchPageHit): Promise<NotionSavedDestination[]> => {
      if (!hit?.id?.trim()) throw new Error('Notion: Seite ungueltig.')
      return addNotionFavorite(hit)
    }
  )

  ipcMain.handle(
    IPC.notion.removeFavorite,
    async (_event, pageId: string): Promise<NotionSavedDestination[]> => {
      if (typeof pageId !== 'string' || !pageId.trim()) {
        throw new Error('Notion: pageId fehlt.')
      }
      return removeNotionFavorite(pageId.trim())
    }
  )

  ipcMain.handle(
    IPC.notion.createPage,
    async (_event, input: NotionCreatePageInput): Promise<NotionCreatePageResult> => {
      if (!input || typeof input.title !== 'string') {
        throw new Error('Notion: Seitentitel fehlt.')
      }
      const kind =
        input.kind === 'calendar' || input.kind === 'mail' || input.kind === 'note'
          ? input.kind
          : 'mail'
      return createNotionPage(input.title, input.parentPageId, kind)
    }
  )

  ipcMain.handle(
    IPC.notion.createMailPage,
    async (_event, input: NotionCreateMailPageInput): Promise<NotionAppendResult> => {
      if (!input || typeof input.messageId !== 'number' || typeof input.title !== 'string') {
        throw new Error('Notion: Mail oder Seitentitel fehlt.')
      }
      return createMailAsNotionPage(
        input.messageId,
        input.title,
        input.parentPageId,
        input.webLink
      )
    }
  )

  ipcMain.handle(
    IPC.notion.createEventPage,
    async (_event, input: NotionCreateEventPageInput): Promise<NotionAppendResult> => {
      if (!input?.event || typeof input.title !== 'string') {
        throw new Error('Notion: Termin oder Seitentitel fehlt.')
      }
      return createCalendarEventAsNotionPage(
        input.event,
        input.title,
        input.parentPageId,
        input.localeCode === 'en' ? 'en' : 'de'
      )
    }
  )

  ipcMain.handle(
    IPC.notion.appendNote,
    async (_event, input: NotionAppendNoteInput): Promise<NotionAppendResult> => {
      if (!input || typeof input.noteId !== 'number') {
        throw new Error('Notion: noteId fehlt.')
      }
      return appendNoteToNotion(
        input.noteId,
        input.pageId,
        input.localeCode === 'en' ? 'en' : 'de'
      )
    }
  )

  ipcMain.handle(
    IPC.notion.createNotePage,
    async (_event, input: NotionCreateNotePageInput): Promise<NotionAppendResult> => {
      if (!input || typeof input.noteId !== 'number' || typeof input.title !== 'string') {
        throw new Error('Notion: Notiz oder Seitentitel fehlt.')
      }
      return createNoteAsNotionPage(
        input.noteId,
        input.title,
        input.parentPageId,
        input.localeCode === 'en' ? 'en' : 'de'
      )
    }
  )

  ipcMain.handle(
    IPC.notion.searchKurtrocksEvents,
    async (_event, query: string): Promise<NotionKurtrocksEventHit[]> => {
      return searchKurtrocksEvents(typeof query === 'string' ? query : '')
    }
  )

  ipcMain.handle(
    IPC.notion.importKurtrocksEventForWebinar,
    async (_event, pageId: string): Promise<NotionWebinarImportResult> => {
      if (typeof pageId !== 'string' || !pageId.trim()) {
        throw new Error('Notion: pageId fehlt.')
      }
      return importKurtrocksEventForWebinar(pageId.trim())
    }
  )

  ipcMain.handle(
    IPC.notion.updateKurtrocksEventLinks,
    async (
      _event,
      raw: NotionUpdateKurtrocksEventLinksInput
    ): Promise<NotionUpdateKurtrocksEventLinksResult> => {
      if (!raw || typeof raw.pageId !== 'string' || !raw.pageId.trim()) {
        throw new Error('Notion: pageId fehlt.')
      }
      return updateKurtrocksEventLinks({
        pageId: raw.pageId.trim(),
        surveyUrl: typeof raw.surveyUrl === 'string' ? raw.surveyUrl : raw.surveyUrl ?? null,
        meetingUrl: typeof raw.meetingUrl === 'string' ? raw.meetingUrl : raw.meetingUrl ?? null
      })
    }
  )
}
