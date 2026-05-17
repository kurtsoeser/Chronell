import { FilePlus, Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppModeStore } from '@/stores/app-mode'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'

export function DashboardNotesNewTile(): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const [busy, setBusy] = useState(false)

  const createNote = useCallback(async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const note = await window.mailClient.notes.createStandalone({
        title: null,
        body: ''
      })
      useNotesPendingFocusStore.getState().setPendingNoteId(note.id)
      setAppMode('notes')
    } catch {
      // Fehler still — Kachel bleibt nutzbar
    } finally {
      setBusy(false)
    }
  }, [busy, setAppMode])

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4">
      <button
        type="button"
        disabled={busy}
        onClick={(): void => void createNote()}
        className="flex w-full max-w-[14rem] flex-col items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-5 text-center transition-colors hover:bg-secondary disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        ) : (
          <FilePlus className="h-8 w-8 text-primary" strokeWidth={1.75} aria-hidden />
        )}
        <span className="text-sm font-semibold text-foreground">{t('dashboard.notesNew.action')}</span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          {t('dashboard.notesNew.hint')}
        </span>
      </button>
    </div>
  )
}
