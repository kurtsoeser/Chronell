import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { UserNote, UserNoteListItem } from '@shared/types'
import {
  noteBodiesEqual,
  prepareNoteBodyForEditor,
  storedBodyFromEditorHtml
} from '@/lib/note-body-html'

export interface UseNoteBodyEditingOptions {
  note: UserNoteListItem | UserNote | null
  autosaveMs?: number
  persistBody: (note: UserNoteListItem, editorHtml: string) => Promise<UserNote>
  onSaved?: (saved: UserNote, editorHtml: string) => void
}

export interface UseNoteBodyEditingResult {
  bodyRef: MutableRefObject<string>
  savedBodyRef: MutableRefObject<string>
  editorFlushRef: MutableRefObject<(() => void) | null>
  editorSeedHtml: string
  setEditorSeedHtml: (html: string) => void
  saving: boolean
  handleBodyChange: (html: string) => void
  flushSave: () => Promise<void>
  loadNoteBody: (target: UserNoteListItem | UserNote) => Promise<void>
}

export function useNoteBodyEditing({
  note,
  autosaveMs = 800,
  persistBody,
  onSaved
}: UseNoteBodyEditingOptions): UseNoteBodyEditingResult {
  const bodyRef = useRef('')
  const savedBodyRef = useRef('')
  const editorFlushRef = useRef<(() => void) | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorSeedHtml, setEditorSeedHtml] = useState('')
  const [saving, setSaving] = useState(false)

  const flushSave = useCallback(async (): Promise<void> => {
    if (autosaveTimerRef.current != null) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    if (note == null) return
    editorFlushRef.current?.()
    const storedDraft = storedBodyFromEditorHtml(bodyRef.current)
    if (noteBodiesEqual(storedDraft, savedBodyRef.current)) return
    setSaving(true)
    try {
      const saved = await persistBody(note as UserNoteListItem, bodyRef.current)
      const editorHtml = prepareNoteBodyForEditor(saved.body).html
      bodyRef.current = editorHtml
      savedBodyRef.current = saved.body
      setEditorSeedHtml(editorHtml)
      onSaved?.(saved, editorHtml)
    } catch {
      // stillschweigend — Aufrufer kann Toast setzen
    } finally {
      setSaving(false)
    }
  }, [note, onSaved, persistBody])

  const scheduleAutosave = useCallback((): void => {
    if (autosaveTimerRef.current != null) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void flushSave()
    }, autosaveMs)
  }, [autosaveMs, flushSave])

  const handleBodyChange = useCallback(
    (html: string): void => {
      bodyRef.current = html
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const loadNoteBody = useCallback(async (target: UserNoteListItem | UserNote): Promise<void> => {
    const prepared = prepareNoteBodyForEditor(target.body)
    const editorHtml = prepared.html
    bodyRef.current = editorHtml
    savedBodyRef.current = target.body
    setEditorSeedHtml(editorHtml)

    if (prepared.migratedFromMarkdown) {
      try {
        const saved = await persistBody(target as UserNoteListItem, editorHtml)
        const syncedHtml = prepareNoteBodyForEditor(saved.body).html
        bodyRef.current = syncedHtml
        savedBodyRef.current = saved.body
        setEditorSeedHtml(syncedHtml)
        onSaved?.(saved, syncedHtml)
      } catch {
        // Migriertes HTML bleibt im Editor.
      }
    }
  }, [onSaved, persistBody])

  useEffect(() => {
    return (): void => {
      if (autosaveTimerRef.current != null) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      void flushSave()
    }
  }, [flushSave])

  return {
    bodyRef,
    savedBodyRef,
    editorFlushRef,
    editorSeedHtml,
    setEditorSeedHtml,
    saving,
    handleBodyChange,
    flushSave,
    loadNoteBody
  }
}
