import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, PenLine, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TipTapNoteEditorLazy } from '@/components/TipTapNoteEditorLazy'
import { storedBodyFromEditorHtml } from '@/lib/note-body-html'
import { openCreatedNote } from '@/lib/mail-to-note'
import { registerNotesEditorFlush } from '@/lib/notes-editor-flush-bridge'
import { withNoteSaveRetry } from '@/lib/note-save-with-retry'
import { PopoutTitlebarControls } from '@/app/layout/PopoutTitlebarControls'
import { useNoteInkDraw } from '@/app/notes/use-note-ink-draw'
import {
  moduleColumnHeaderShellBarClass,
  moduleColumnHeaderTitleClass
} from '@/components/ModuleColumnHeader'
import { cn } from '@/lib/utils'
import { useFramelessTitlebar } from '@/lib/use-frameless-titlebar'
import { useUndoStore } from '@/stores/undo'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function QuickCapturePopoutShell(): JSX.Element {
  const { t } = useTranslation()
  const frameless = useFramelessTitlebar()
  const pushToast = useUndoStore((s) => s.pushToast)
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [draftNoteId, setDraftNoteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const flushRef = useRef<(() => void) | null>(null)
  const insertHtmlRef = useRef<((html: string) => void) | null>(null)
  const replaceInkSnapshotRef = useRef<((inkJsonAttachmentId: number, html: string) => void) | null>(
    null
  )
  const titleRef = useRef(title)
  const bodyHtmlRef = useRef(bodyHtml)
  const draftNoteIdRef = useRef(draftNoteId)

  titleRef.current = title
  bodyHtmlRef.current = bodyHtml
  draftNoteIdRef.current = draftNoteId

  const hasDraftContent = useCallback((): boolean => {
    return titleRef.current.trim().length > 0 || storedBodyFromEditorHtml(bodyHtmlRef.current).trim().length > 0
  }, [])

  const persistDraftSilently = useCallback(async (): Promise<void> => {
    flushRef.current?.()
    if (!hasDraftContent()) return
    const payload = {
      title: titleRef.current.trim() || t('notes.quickCapture.defaultTitle'),
      body: storedBodyFromEditorHtml(bodyHtmlRef.current)
    }
    const existingId = draftNoteIdRef.current
    if (existingId != null) {
      await withNoteSaveRetry(() =>
        window.mailClient.notes.updateStandalone({
          id: existingId,
          ...payload
        })
      )
      return
    }
    const note = await withNoteSaveRetry(() =>
      window.mailClient.notes.createStandalone({
        ...payload,
        sectionId: null
      })
    )
    setDraftNoteId(note.id)
    draftNoteIdRef.current = note.id
  }, [hasDraftContent, t])

  useZoomShortcuts()

  const resolveDraftNoteId = useCallback(async (): Promise<number> => {
    if (draftNoteId != null) return draftNoteId
    flushRef.current?.()
    const note = await window.mailClient.notes.createStandalone({
      title: title.trim() || t('notes.quickCapture.defaultTitle'),
      body: storedBodyFromEditorHtml(bodyHtml),
      sectionId: null
    })
    setDraftNoteId(note.id)
    return note.id
  }, [bodyHtml, draftNoteId, t, title])

  const noteInk = useNoteInkDraw({
    noteId: draftNoteId,
    resolveNoteId: resolveDraftNoteId,
    insertHtmlRef,
    replaceInkSnapshotRef,
    onError: (message): void => {
      pushToast({ label: message, variant: 'error' })
    },
    onSuccess: (message): void => {
      pushToast({ label: message, variant: 'success' })
    }
  })

  const handleClose = useCallback((): void => {
    void (async (): Promise<void> => {
      try {
        await persistDraftSilently()
      } catch {
        // Schliessen trotzdem erlauben.
      }
      await window.mailClient.quickCapture.close()
    })()
  }, [persistDraftSilently])

  useEffect(() => {
    return registerNotesEditorFlush(() => persistDraftSilently())
  }, [persistDraftSilently])

  const handleSave = useCallback(async (): Promise<void> => {
    flushRef.current?.()
    setSaving(true)
    try {
      const payload = {
        title: title.trim() || t('notes.quickCapture.defaultTitle'),
        body: storedBodyFromEditorHtml(bodyHtml)
      }
      if (draftNoteId != null) {
        await withNoteSaveRetry(() =>
          window.mailClient.notes.updateStandalone({
            id: draftNoteId,
            ...payload
          })
        )
        openCreatedNote(draftNoteId)
      } else {
        const note = await withNoteSaveRetry(() =>
          window.mailClient.notes.createStandalone({
            ...payload,
            sectionId: null
          })
        )
        openCreatedNote(note.id)
      }
      await window.mailClient.quickCapture.close()
    } finally {
      setSaving(false)
    }
  }, [bodyHtml, draftNoteId, t, title])

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header
        className={cn(
          moduleColumnHeaderShellBarClass,
          frameless && 'glass-topbar electron-window-titlebar h-12 select-none pr-0'
        )}
      >
        <span className={cn(moduleColumnHeaderTitleClass, 'min-w-0 flex-1 truncate')}>
          {t('notes.quickCapture.windowTitle')}
        </span>
        <PopoutTitlebarControls onClose={handleClose} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <input
          type="text"
          value={title}
          onChange={(e): void => setTitle(e.target.value)}
          placeholder={t('notes.quickCapture.titlePlaceholder')}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!noteInk.canUseInk || saving}
            onClick={noteInk.openNew}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            {t('notes.ink.button')}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
          <TipTapNoteEditorLazy
            valueHtml={bodyHtml}
            onChangeHtml={setBodyHtml}
            placeholder={t('notes.quickCapture.bodyPlaceholder')}
            fillHeight
            variant="compact"
            showThemeToggle={false}
            flushRef={flushRef}
            insertHtmlRef={insertHtmlRef}
            replaceInkSnapshotRef={replaceInkSnapshotRef}
            onInkImageDoubleClick={(attachmentId): void => {
              void noteInk.openInkEdit(attachmentId)
            }}
            currentNoteId={draftNoteId ?? undefined}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={(): void => void handleSave()}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('common.save')}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">{t('notes.quickCapture.hint')}</p>
      </div>
      {noteInk.inkDialog}
    </div>
  )
}
