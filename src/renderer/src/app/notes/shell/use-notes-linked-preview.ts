import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NoteLinksBundle } from '@shared/note-entity-links'
import type { UserNote } from '@shared/types'
import { buildNotesPreviewLinkEntries } from '@/app/notes/notes-link-preview-items'
import {
  persistNotesLinkedPreviewOpen,
  persistNotesLinkedPreviewPlacement,
  readNotesLinkedPreviewOpen,
  readNotesLinkedPreviewPlacement
} from '@/app/notes/notes-shell-storage'
import { useResizableWidth } from '@/components/ResizableSplitter'
import { NOTES_PREVIEW_DOCK_WIDTH_KEY } from '@/app/notes/shell/notes-shell-types'
import type { NotesSettingsPrefsV1 } from '@/lib/notes-settings-prefs'

export function useNotesLinkedPreview(
  editing: UserNote | null,
  notesSettings: NotesSettingsPrefsV1,
  linksBodyHtml?: string
) {
  const { t } = useTranslation()
  const [linkedPreviewOpen, setLinkedPreviewOpen] = useState(() => readNotesLinkedPreviewOpen())
  const [linkedPreviewPlacement, setLinkedPreviewPlacement] = useState(() =>
    readNotesLinkedPreviewPlacement()
  )
  const [linkedPreviewKey, setLinkedPreviewKey] = useState<string | null>(null)
  const [linksBundle, setLinksBundle] = useState<NoteLinksBundle | null>(null)

  const [previewDockWidth, setPreviewDockWidth] = useResizableWidth({
    storageKey: NOTES_PREVIEW_DOCK_WIDTH_KEY,
    defaultWidth: notesSettings.defaultLinkedPreviewDockWidth,
    minWidth: 260,
    maxWidth: 720
  })

  const reloadLinksBundle = useCallback(async (noteId: number): Promise<void> => {
    const bundle = await window.mailClient.notes.links.list(noteId)
    setLinksBundle(bundle)
  }, [])

  const previewEntries = useMemo(() => {
    if (!editing || !linksBundle) return []
    return buildNotesPreviewLinkEntries(editing, linksBundle, t, linksBodyHtml)
  }, [editing, linksBundle, linksBodyHtml, t])

  useEffect(() => {
    if (!editing) {
      setLinksBundle(null)
      setLinkedPreviewKey(null)
      return
    }
    let cancelled = false
    void window.mailClient.notes.links.list(editing.id).then((bundle) => {
      if (!cancelled) setLinksBundle(bundle)
    })
    return (): void => {
      cancelled = true
    }
  }, [editing?.id])

  useEffect(() => {
    if (previewEntries.length === 0) {
      setLinkedPreviewKey(null)
      return
    }
    setLinkedPreviewKey((prev) =>
      prev && previewEntries.some((e) => e.key === prev) ? prev : (previewEntries[0]?.key ?? null)
    )
  }, [previewEntries])

  const toggleLinkedPreview = useCallback((): void => {
    setLinkedPreviewOpen((open) => {
      const next = !open
      persistNotesLinkedPreviewOpen(next)
      return next
    })
  }, [])

  const openLinkedPreview = useCallback((): void => {
    setLinkedPreviewOpen(true)
    persistNotesLinkedPreviewOpen(true)
  }, [])

  const setLinkedPreviewPlacementPersisted = useCallback(
    (placement: ReturnType<typeof readNotesLinkedPreviewPlacement>): void => {
      setLinkedPreviewPlacement(placement)
      persistNotesLinkedPreviewPlacement(placement)
    },
    []
  )

  const closeLinkedPreview = useCallback((): void => {
    setLinkedPreviewOpen(false)
    persistNotesLinkedPreviewOpen(false)
  }, [])

  return {
    linkedPreviewOpen,
    linkedPreviewPlacement,
    linkedPreviewKey,
    setLinkedPreviewKey,
    linksBundle,
    setLinksBundle,
    previewEntries,
    previewDockWidth,
    setPreviewDockWidth,
    reloadLinksBundle,
    toggleLinkedPreview,
    openLinkedPreview,
    setLinkedPreviewPlacementPersisted,
    closeLinkedPreview
  }
}
