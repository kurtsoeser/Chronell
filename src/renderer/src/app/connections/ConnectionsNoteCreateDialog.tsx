import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

export function ConnectionsNoteCreateDialog({
  open,
  onClose,
  onCreated
}: {
  open: boolean
  onClose: () => void
  onCreated: (payload: { title: string; body: string }) => void | Promise<void>
}): JSX.Element | null {
  const { t } = useTranslation()
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setBody('')
    setError(null)
    setBusy(false)
    window.requestAnimationFrame(() => titleRef.current?.focus())
  }, [open])

  if (!open) return null

  const submit = async (): Promise<void> => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError(t('connections.canvasCreate.noteTitleRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreated({ title: trimmedTitle, body: body.trim() })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalRoot open={open} onBackdropClick={onClose} zIndex={120}>
      <ModalPanel className="flex w-full max-w-lg flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t('connections.canvasCreate.noteTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('connections.canvasCreate.noteFieldTitle')}
          </span>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e): void => setTitle(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('connections.canvasCreate.noteFieldBody')}
          </span>
          <textarea
            value={body}
            onChange={(e): void => setBody(e.target.value)}
            rows={6}
            className="resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(): void => void submit()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('common.create')}
          </button>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
