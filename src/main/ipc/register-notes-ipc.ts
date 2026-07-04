import { BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import {
  IPC,
  type NoteSection,
  type NoteSectionCreateInput,
  type NoteSectionReorderInput,
  type NoteSectionUpdateInput,
  type UserNote,
  type UserNoteCalendarKey,
  type UserNoteCalendarUpsertInput,
  type NoteLinksBundle,
  type UserNoteLinkAddInput,
  type UserNoteLinkRemoveInput,
  type NoteLinkTargetCandidate,
  type UserNoteListFilters,
  type UserNoteListInRangeFilters,
  type UserNoteListItem,
  type UserNoteSearchFilters,
  type UserNoteMailUpsertInput,
  type UserNotePeopleContactUpsertInput,
  type UserNoteMoveToSectionInput,
  type UserNoteMoveToParentInput,
  type UserNoteSetCategoriesInput,
  type UserNoteSetPinnedInput,
  type UserNoteScheduleInput,
  type UserNoteStandaloneCreateInput,
  type UserNotePatchDisplayInput,
  type UserNoteStandaloneUpdateInput,
  type NotesChangedScope,
  type NotesChangedPayload,
  type UserNoteAttachment,
  type UserNoteAttachmentAddCloudInput,
  type UserNoteAttachmentAddLocalInput,
  type PeopleContactLinkedNote
} from '@shared/types'
import {
  addCloudNoteAttachment,
  addLocalNoteAttachment,
  getNoteAttachmentById,
  listNoteAttachments,
  removeNoteAttachment
} from '../db/user-note-attachments-repo'
import { sanitizeFileName } from './ipc-helpers'
import { resolveAudioContentType } from '@shared/note-attachment-audio'
import { normalizeAudioMimeForPlayback } from '@shared/note-attachment-media-url'
import {
  createNoteSection,
  deleteNoteSection,
  listNoteSections,
  reorderNoteSections,
  updateNoteSection
} from '../db/note-sections-repo'
import {
  addNoteEntityLink,
  listNoteLinksBundle,
  listNotesLinkedToPeopleContact,
  removeNoteEntityLink,
  removeNoteEntityLinkIncoming
} from '../db/user-note-entity-links-repo'
import { searchNoteLinkTargets } from '../note-link-target-search'
import {
  clearNoteSchedule,
  createStandaloneNote,
  deleteNote,
  getCalendarNote,
  getMailNote,
  getPeopleContactNoteForEditor,
  getPrimaryNoteForPeopleContact,
  tryAutoLinkNoteToContactByTitle,
  getNoteById,
  getNoteListItemById,
  listNotes,
  listNotesInRange,
  listNotesShellBootstrap,
  searchNotes,
  moveNoteToSection,
  moveNoteToParent,
  setNoteCategories,
  setNotePinned,
  patchNoteDisplay,
  setNoteSchedule,
  updateStandaloneNote,
  upsertCalendarNote,
  upsertMailNote,
  upsertPrimaryNoteForPeopleContact
} from '../db/user-notes-repo'
import {
  queueEntityEmbeddingForNote,
  removeEntityEmbeddingsForNote
} from '../ai/entity-embeddings-queue'
import { broadcastEntityLinksChanged, broadcastNotesChanged } from './ipc-broadcasts'
import { buildNotesChangedPayload } from '../notes-changed-payload'
import { exportNotePageToPdf, printNotePage } from '../notes-page-export'

const NOTE_ATTACHMENT_READ_LOCAL_MAX_BYTES = 50 * 1024 * 1024

function broadcastNoteDelta(
  noteId: number,
  scope: NotesChangedScope,
  extra?: Omit<NotesChangedPayload, 'noteId' | 'scope' | 'patch' | 'deleted'>
): void {
  broadcastNotesChanged({ ...buildNotesChangedPayload(noteId, scope), ...extra })
}

export function registerNotesIpc(): void {
  ipcMain.handle(IPC.notes.getMail, (_event, messageId: number): UserNote | null =>
    getMailNote(messageId)
  )

  ipcMain.handle(IPC.notes.upsertMail, (_event, input: UserNoteMailUpsertInput): UserNote => {
    const note = upsertMailNote(input)
    queueEntityEmbeddingForNote(note)
    broadcastNoteDelta(note.id, 'content', { kind: 'mail', messageId: note.messageId })
    return note
  })

  ipcMain.handle(
    IPC.notes.getPeopleContact,
    (_event, contactId: number): UserNote | null => {
      const id = typeof contactId === 'number' ? contactId : 0
      if (!id) return null
      return getPeopleContactNoteForEditor(id)
    }
  )

  ipcMain.handle(
    IPC.notes.upsertPeopleContact,
    (_event, input: UserNotePeopleContactUpsertInput): UserNote => {
      const note = upsertPrimaryNoteForPeopleContact(input)
      queueEntityEmbeddingForNote(note)
      broadcastNoteDelta(note.id, 'content', { kind: 'standalone' })
      return note
    }
  )

  ipcMain.handle(IPC.notes.getCalendar, (_event, key: UserNoteCalendarKey): UserNote | null =>
    getCalendarNote(key)
  )

  ipcMain.handle(
    IPC.notes.upsertCalendar,
    (_event, input: UserNoteCalendarUpsertInput): UserNote => {
      const note = upsertCalendarNote(input)
      queueEntityEmbeddingForNote(note)
      broadcastNoteDelta(note.id, 'content', { kind: 'calendar', accountId: note.accountId })
      return note
    }
  )

  ipcMain.handle(
    IPC.notes.createStandalone,
    (_event, input: UserNoteStandaloneCreateInput): UserNote => {
      const note = createStandaloneNote(input)
      queueEntityEmbeddingForNote(note)
      broadcastNoteDelta(note.id, 'structure', { kind: 'standalone' })
      return note
    }
  )

  ipcMain.handle(
    IPC.notes.updateStandalone,
    (_event, input: UserNoteStandaloneUpdateInput): UserNote => {
      const note = updateStandaloneNote(input)
      queueEntityEmbeddingForNote(note)
      broadcastNoteDelta(note.id, 'content', { kind: 'standalone' })
      return note
    }
  )

  ipcMain.handle(IPC.notes.delete, (_event, id: number): void => {
    removeEntityEmbeddingsForNote(id)
    deleteNote(id)
    broadcastNotesChanged(buildNotesChangedPayload(id, 'structure', { deleted: true }))
  })

  ipcMain.handle(
    IPC.notes.listShellBootstrap,
    (_event, filters?: UserNoteListFilters) => listNotesShellBootstrap(filters ?? {})
  )

  ipcMain.handle(IPC.notes.list, (_event, filters?: UserNoteListFilters): UserNoteListItem[] =>
    listNotes(filters ?? {})
  )

  ipcMain.handle(
    IPC.notes.search,
    (_event, filters: UserNoteSearchFilters): UserNoteListItem[] => searchNotes(filters)
  )

  ipcMain.handle(
    IPC.notes.getById,
    (_event, id: number): UserNoteListItem | null => getNoteListItemById(id, { omitBody: false })
  )

  ipcMain.handle(IPC.notes.patchDisplay, (_event, input: UserNotePatchDisplayInput): UserNote => {
    const noteId = typeof input?.noteId === 'number' ? input.noteId : 0
    if (!noteId) throw new Error('Notiz-ID fehlt.')
    const note = patchNoteDisplay(noteId, {
      iconId: input.iconId,
      iconColor: input.iconColor
    })
    queueEntityEmbeddingForNote(note)
    broadcastNoteDelta(note.id, 'meta')
    return note
  })

  ipcMain.handle(
    IPC.notes.listInRange,
    (_event, filters: UserNoteListInRangeFilters): UserNoteListItem[] => listNotesInRange(filters)
  )

  ipcMain.handle(IPC.notes.setSchedule, (_event, input: UserNoteScheduleInput): UserNote => {
    const note = setNoteSchedule(input)
    queueEntityEmbeddingForNote(note)
    broadcastNoteDelta(note.id, 'content', { kind: note.kind })
    return note
  })

  ipcMain.handle(IPC.notes.clearSchedule, (_event, id: number): UserNote => {
    const note = clearNoteSchedule(id)
    queueEntityEmbeddingForNote(note)
    broadcastNoteDelta(note.id, 'content', { kind: note.kind })
    return note
  })

  ipcMain.handle(IPC.notes.moveToSection, (_event, input: UserNoteMoveToSectionInput): UserNote => {
    const note = moveNoteToSection(input)
    queueEntityEmbeddingForNote(note)
    broadcastNoteDelta(note.id, 'meta', { kind: note.kind })
    return note
  })

  ipcMain.handle(IPC.notes.moveToParent, (_event, input: UserNoteMoveToParentInput): UserNote => {
    const note = moveNoteToParent(input)
    queueEntityEmbeddingForNote(note)
    broadcastNoteDelta(note.id, 'meta', { kind: note.kind })
    return note
  })

  ipcMain.handle(IPC.notes.setCategories, (_event, input: UserNoteSetCategoriesInput): UserNote => {
    const note = setNoteCategories(input.noteId, input.accountId, input.categories)
    queueEntityEmbeddingForNote(note)
    broadcastNoteDelta(note.id, 'meta', { kind: note.kind })
    return note
  })

  ipcMain.handle(IPC.notes.setPinned, (_event, input: UserNoteSetPinnedInput): UserNote => {
    const note = setNotePinned(input.noteId, input.isPinned)
    broadcastNoteDelta(note.id, 'meta', { kind: note.kind })
    return note
  })

  ipcMain.handle(IPC.notes.sectionsList, (): NoteSection[] => listNoteSections())

  ipcMain.handle(IPC.notes.sectionsCreate, (_event, input: NoteSectionCreateInput): NoteSection => {
    const section = createNoteSection(input)
    broadcastNotesChanged({ scope: 'structure' })
    return section
  })

  ipcMain.handle(IPC.notes.sectionsUpdate, (_event, input: NoteSectionUpdateInput): NoteSection => {
    const section = updateNoteSection(input)
    broadcastNotesChanged({ scope: 'structure' })
    return section
  })

  ipcMain.handle(IPC.notes.sectionsDelete, (_event, id: number): void => {
    deleteNoteSection(id)
    broadcastNotesChanged({ scope: 'structure' })
  })

  ipcMain.handle(IPC.notes.sectionsReorder, (_event, input: NoteSectionReorderInput): void => {
    reorderNoteSections(input)
    broadcastNotesChanged({ scope: 'structure' })
  })

  ipcMain.handle(IPC.notes.linksList, (_event, fromNoteId: number): NoteLinksBundle => {
    const id = typeof fromNoteId === 'number' ? fromNoteId : 0
    if (!id) return { outgoing: [], incoming: [] }
    if (tryAutoLinkNoteToContactByTitle(id)) {
      broadcastNotesChanged({ kind: 'standalone', noteId: id, scope: 'links' })
      broadcastEntityLinksChanged()
    }
    return listNoteLinksBundle(id)
  })

  ipcMain.handle(IPC.notes.linksAdd, (_event, input: UserNoteLinkAddInput): void => {
    const fromNoteId = typeof input?.fromNoteId === 'number' ? input.fromNoteId : 0
    const target = input?.target
    if (!fromNoteId || !target || typeof target !== 'object' || !('kind' in target)) {
      throw new Error('Verknuepfung ungueltig.')
    }
    addNoteEntityLink(fromNoteId, target)
    broadcastNotesChanged({ noteId: fromNoteId, scope: 'links' })
    broadcastEntityLinksChanged()
  })

  ipcMain.handle(IPC.notes.linksRemove, (_event, input: UserNoteLinkRemoveInput): void => {
    const fromNoteId = typeof input?.fromNoteId === 'number' ? input.fromNoteId : 0
    const linkId = typeof input?.linkId === 'number' ? input.linkId : 0
    if (!fromNoteId || !linkId) throw new Error('Verknuepfung fehlt.')
    if (input?.direction === 'incoming') {
      removeNoteEntityLinkIncoming(linkId, fromNoteId)
    } else {
      removeNoteEntityLink(linkId, fromNoteId)
    }
    broadcastNotesChanged({ noteId: fromNoteId, scope: 'links' })
    broadcastEntityLinksChanged()
  })

  ipcMain.handle(
    IPC.notes.linksSearchTargets,
    (
      _event,
      args: { query?: string; excludeNoteId?: number; limit?: number }
    ): NoteLinkTargetCandidate[] => {
      return searchNoteLinkTargets(typeof args?.query === 'string' ? args.query : '', {
        excludeNoteId: args?.excludeNoteId,
        limit: args?.limit
      })
    }
  )

  ipcMain.handle(
    IPC.notes.listForContact,
    (_event, contactId: number): PeopleContactLinkedNote[] => {
      const id = typeof contactId === 'number' ? contactId : 0
      if (!id) return []
      return listNotesLinkedToPeopleContact(id)
    }
  )

  ipcMain.handle(
    IPC.notes.attachmentsList,
    (_event, noteId: number): UserNoteAttachment[] => {
      const id = typeof noteId === 'number' ? noteId : 0
      if (!id) return []
      return listNoteAttachments(id)
    }
  )

  ipcMain.handle(
    IPC.notes.attachmentsAddLocal,
    async (_event, input: UserNoteAttachmentAddLocalInput): Promise<UserNoteAttachment> => {
      const att = await addLocalNoteAttachment(input)
      broadcastNotesChanged({ noteId: input.noteId, scope: 'attachments' })
      return att
    }
  )

  ipcMain.handle(
    IPC.notes.attachmentsAddCloud,
    (_event, input: UserNoteAttachmentAddCloudInput): UserNoteAttachment => {
      const att = addCloudNoteAttachment(input)
      broadcastNotesChanged({ noteId: input.noteId, scope: 'attachments' })
      return att
    }
  )

  ipcMain.handle(
    IPC.notes.attachmentsRemove,
    async (_event, args: { noteId: number; attachmentId: number }): Promise<void> => {
      const noteId = typeof args?.noteId === 'number' ? args.noteId : 0
      const attachmentId = typeof args?.attachmentId === 'number' ? args.attachmentId : 0
      if (!noteId || !attachmentId) throw new Error('Anhang fehlt.')
      await removeNoteAttachment(attachmentId, noteId)
      broadcastNotesChanged({ noteId, scope: 'attachments' })
    }
  )

  ipcMain.handle(
    IPC.notes.attachmentsOpen,
    async (
      _event,
      args: { noteId: number; attachmentId: number }
    ): Promise<{ ok: boolean; error?: string }> => {
      const noteId = typeof args?.noteId === 'number' ? args.noteId : 0
      const attachmentId = typeof args?.attachmentId === 'number' ? args.attachmentId : 0
      const att = noteId && attachmentId ? getNoteAttachmentById(attachmentId, noteId) : null
      if (!att) return { ok: false, error: 'Anhang nicht gefunden.' }
      try {
        if (att.kind === 'cloud') {
          if (!att.sourceUrl) return { ok: false, error: 'Cloud-Link fehlt.' }
          await shell.openExternal(att.sourceUrl)
          return { ok: true }
        }
        if (!att.localPath) return { ok: false, error: 'Dateipfad fehlt.' }
        if (resolveAudioContentType(att).startsWith('audio/')) {
          return { ok: true }
        }
        const err = await shell.openPath(att.localPath)
        if (err) return { ok: false, error: err }
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle(
    IPC.notes.attachmentsSaveAs,
    async (
      event,
      args: { noteId: number; attachmentId: number; suggestedName?: string }
    ): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> => {
      const noteId = typeof args?.noteId === 'number' ? args.noteId : 0
      const attachmentId = typeof args?.attachmentId === 'number' ? args.attachmentId : 0
      const att = noteId && attachmentId ? getNoteAttachmentById(attachmentId, noteId) : null
      if (!att) return { ok: false, error: 'Anhang nicht gefunden.' }

      if (att.kind === 'cloud') {
        if (!att.sourceUrl) return { ok: false, error: 'Cloud-Link fehlt.' }
        await shell.openExternal(att.sourceUrl)
        return { ok: true }
      }

      if (!att.localPath) return { ok: false, error: 'Dateipfad fehlt.' }

      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const suggested = sanitizeFileName(args.suggestedName ?? att.name)
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: suggested,
        title: 'Anhang speichern unter'
      })
      if (result.canceled || !result.filePath) {
        return { ok: false, cancelled: true }
      }
      try {
        await fs.copyFile(att.localPath, result.filePath)
        return { ok: true, path: result.filePath }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle(
    IPC.notes.attachmentsReadLocal,
    async (
      _event,
      args: { noteId: number; attachmentId: number }
    ): Promise<
      | { ok: true; dataBase64: string; contentType: string }
      | { ok: false; error: string }
    > => {
      const noteId = typeof args?.noteId === 'number' ? args.noteId : 0
      const attachmentId = typeof args?.attachmentId === 'number' ? args.attachmentId : 0
      const att = noteId && attachmentId ? getNoteAttachmentById(attachmentId, noteId) : null
      if (!att) return { ok: false, error: 'Anhang nicht gefunden.' }
      if (att.kind !== 'local' || !att.localPath) {
        return { ok: false, error: 'Nur lokale Anhänge können abgespielt werden.' }
      }
      try {
        const stat = await fs.stat(att.localPath)
        if (stat.size > NOTE_ATTACHMENT_READ_LOCAL_MAX_BYTES) {
          return { ok: false, error: 'Datei ist zu groß für die Wiedergabe.' }
        }
        const buffer = await fs.readFile(att.localPath)
        const contentType = normalizeAudioMimeForPlayback(
          att.contentType?.startsWith('audio/')
            ? att.contentType
            : resolveAudioContentType({
                kind: att.kind,
                name: att.name,
                contentType: att.contentType
              })
        )
        return {
          ok: true,
          dataBase64: buffer.toString('base64'),
          contentType
        }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle(
    IPC.notes.exportPdf,
    async (
      event,
      input: { title: string; bodyHtml: string; suggestedFileName?: string }
    ): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      return exportNotePageToPdf(win, {
        title: typeof input?.title === 'string' ? input.title : '',
        bodyHtml: typeof input?.bodyHtml === 'string' ? input.bodyHtml : '',
        suggestedFileName: input?.suggestedFileName
      })
    }
  )

  ipcMain.handle(
    IPC.notes.printPage,
    async (
      _event,
      input: { title: string; bodyHtml: string }
    ): Promise<{ ok: boolean; error?: string }> => {
      return printNotePage({
        title: typeof input?.title === 'string' ? input.title : '',
        bodyHtml: typeof input?.bodyHtml === 'string' ? input.bodyHtml : ''
      })
    }
  )

  ipcMain.handle(
    IPC.notes.resolveEmbedUrl,
    async (_event, input: unknown): Promise<string | null> => {
      const url = typeof input === 'string' ? input.trim() : ''
      if (!url) return null
      const { resolveNoteEmbedRedirectUrl } = await import('../note-embed-url-resolve')
      return resolveNoteEmbedRedirectUrl(url)
    }
  )

  ipcMain.handle(
    IPC.notes.resolveM365Video,
    async (_event, input: unknown) => {
      const shareUrl =
        typeof input === 'object' &&
        input !== null &&
        'shareUrl' in input &&
        typeof (input as { shareUrl?: unknown }).shareUrl === 'string'
          ? (input as { shareUrl: string }).shareUrl.trim()
          : typeof input === 'string'
            ? input.trim()
            : ''
      const accountId =
        typeof input === 'object' &&
        input !== null &&
        'accountId' in input &&
        typeof (input as { accountId?: unknown }).accountId === 'string'
          ? (input as { accountId: string }).accountId.trim()
          : undefined
      if (!shareUrl) {
        return {
          ok: false,
          error: 'unknown',
          message: 'Freigabe-URL fehlt.',
          ref: { shareUrl: '', error: 'unknown' }
        }
      }
      const { resolveM365VideoEmbed } = await import('../note-m365-video-resolve')
      return resolveM365VideoEmbed({ shareUrl, accountId })
    }
  )

  ipcMain.handle(
    IPC.notes.readClipboardImage,
    (): { dataBase64: string; contentType: string } | null => {
      const image = clipboard.readImage()
      if (image.isEmpty()) return null
      const png = image.toPNG()
      if (!png.length) return null
      return {
        dataBase64: png.toString('base64'),
        contentType: 'image/png'
      }
    }
  )
}
