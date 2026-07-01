import { useCallback, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TipTapNoteEditor } from '@/components/TipTapNoteEditor'
import { storedBodyFromEditorHtml } from '@/lib/note-body-html'
import { openCreatedNote } from '@/lib/mail-to-note'
import { PopoutTitlebarControls } from '@/app/layout/PopoutTitlebarControls'
import {
  moduleColumnHeaderShellBarClass,
  moduleColumnHeaderTitleClass
} from '@/components/ModuleColumnHeader'
import { cn } from '@/lib/utils'
import { useFramelessTitlebar } from '@/lib/use-frameless-titlebar'

export function QuickCapturePopoutShell(): JSX.Element {
  const { t } = useTranslation()
  const frameless = useFramelessTitlebar()
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const flushRef = useRef<(() => void) | null>(null)

  const handleClose = useCallback((): void => {
    void window.mailClient.quickCapture.close()
  }, [])

  const handleSave = useCallback(async (): Promise<void> => {
    flushRef.current?.()
    setSaving(true)
    try {
      const note = await window.mailClient.notes.createStandalone({
        title: title.trim() || t('notes.quickCapture.defaultTitle'),
        body: storedBodyFromEditorHtml(bodyHtml),
        sectionId: null
      })
      openCreatedNote(note.id)
      await window.mailClient.quickCapture.close()
    } finally {
      setSaving(false)
    }
  }, [bodyHtml, t, title])

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
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
          <TipTapNoteEditor
            valueHtml={bodyHtml}
            onChangeHtml={setBodyHtml}
            placeholder={t('notes.quickCapture.bodyPlaceholder')}
            fillHeight
            variant="compact"
            showThemeToggle={false}
            flushRef={flushRef}
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
    </div>
  )
}
