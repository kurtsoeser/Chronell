import { useCallback, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { NoteInkDocument } from '@shared/note-ink-document'
import { NoteInkDrawDialog } from '@/app/notes/NoteInkDrawDialog'
import { appendInkDrawingToNote, replaceInkDrawingInNote } from '@/lib/note-ink-insert'
import { loadInkDocumentFromAttachment } from '@/lib/note-ink-load'

export interface UseNoteInkDrawOptions {
  noteId: number | null | undefined
  insertHtmlRef: MutableRefObject<((html: string) => void) | null>
  replaceInkSnapshotRef: MutableRefObject<
    ((inkJsonAttachmentId: number, html: string) => void) | null
  >
  /** Optional: Notiz-ID erst bei Bedarf anlegen (z. B. Schnellnotiz). */
  resolveNoteId?: () => Promise<number>
  onError?: (message: string) => void
  onSuccess?: (message: string) => void
}

export interface UseNoteInkDrawResult {
  openNew: () => void
  openInkEdit: (inkJsonAttachmentId: number) => Promise<void>
  inkDialog: ReactNode
  canUseInk: boolean
}

export function useNoteInkDraw({
  noteId,
  insertHtmlRef,
  replaceInkSnapshotRef,
  resolveNoteId,
  onError,
  onSuccess
}: UseNoteInkDrawOptions): UseNoteInkDrawResult {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [resolvedNoteId, setResolvedNoteId] = useState<number | null>(noteId ?? null)
  const [initialDocument, setInitialDocument] = useState<NoteInkDocument | null>(null)
  const editInkAttachmentIdRef = useRef<number | null>(null)
  const noteIdRef = useRef(noteId ?? null)
  noteIdRef.current = noteId ?? resolvedNoteId

  const ensureNoteId = useCallback(async (): Promise<number | null> => {
    if (noteIdRef.current != null) return noteIdRef.current
    if (!resolveNoteId) return null
    const id = await resolveNoteId()
    noteIdRef.current = id
    setResolvedNoteId(id)
    return id
  }, [resolveNoteId])

  const openNew = useCallback((): void => {
    void (async (): Promise<void> => {
      const id = await ensureNoteId()
      if (id == null) return
      editInkAttachmentIdRef.current = null
      setInitialDocument(null)
      setOpen(true)
    })()
  }, [ensureNoteId])

  const openInkEdit = useCallback(
    async (inkJsonAttachmentId: number): Promise<void> => {
      const id = await ensureNoteId()
      if (id == null) return
      try {
        const document = await loadInkDocumentFromAttachment(id, inkJsonAttachmentId)
        editInkAttachmentIdRef.current = inkJsonAttachmentId
        setInitialDocument(document)
        setOpen(true)
      } catch (e) {
        onError?.(e instanceof Error ? e.message : String(e))
      }
    },
    [ensureNoteId, onError]
  )

  const handleInsert = useCallback(
    async (payload: { document: NoteInkDocument }): Promise<void> => {
      const id = await ensureNoteId()
      if (id == null) return
      const editId = editInkAttachmentIdRef.current
      try {
        if (editId != null) {
          await replaceInkDrawingInNote(id, editId, payload.document, (oldId, html) => {
            replaceInkSnapshotRef.current?.(oldId, html)
          })
        } else {
          await appendInkDrawingToNote(id, payload.document, (html) => {
            insertHtmlRef.current?.(html)
          })
        }
        onSuccess?.(t('notes.ink.insertedToast'))
        setOpen(false)
        editInkAttachmentIdRef.current = null
        setInitialDocument(null)
      } catch (e) {
        onError?.(e instanceof Error ? e.message : String(e))
      }
    },
    [ensureNoteId, insertHtmlRef, onError, onSuccess, replaceInkSnapshotRef, t]
  )

  const activeNoteId = noteId ?? resolvedNoteId
  const inkDialog =
    activeNoteId != null || resolveNoteId != null ? (
      <NoteInkDrawDialog
        open={open}
        initialDocument={initialDocument}
        onClose={(): void => {
          setOpen(false)
          editInkAttachmentIdRef.current = null
          setInitialDocument(null)
        }}
        onInsert={handleInsert}
      />
    ) : null

  return {
    openNew,
    openInkEdit,
    inkDialog,
    canUseInk: activeNoteId != null || resolveNoteId != null
  }
}
