import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Cloud, FilePlus2, Loader2, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNoteAttachment } from '@shared/types'
import { isPlayableAudioAttachment } from '@shared/note-attachment-audio'
import { cn } from '@/lib/utils'
import { useAccountsStore } from '@/stores/accounts'
import { OneDriveExplorerDialog } from '@/components/OneDriveExplorerDialog'
import { CloudAttachmentChip, LocalAttachmentChip } from '@/components/AttachmentChips'
import { uploadFilesToNote } from '@/lib/note-attachments-upload'
import { NoteAudioRecorder } from '@/app/notes/NoteAudioRecorder'
import { NoteInlineAudioAttachment } from '@/app/notes/NoteInlineAudioAttachment'

function renderLocalAttachment(
  att: UserNoteAttachment,
  noteId: number,
  t: (key: string) => string,
  handleOpen: (att: UserNoteAttachment) => Promise<void>,
  handleRemove: (attachmentId: number) => Promise<void>,
  handleSaveAs: (att: UserNoteAttachment) => Promise<void>,
  setError: (message: string | null) => void
): JSX.Element {
  if (isPlayableAudioAttachment(att)) {
    return (
      <NoteInlineAudioAttachment
        key={att.id}
        noteId={noteId}
        attachment={att}
        onRemove={(): void => void handleRemove(att.id)}
        onSaveAs={(): void => void handleSaveAs(att)}
        onError={setError}
        compact
      />
    )
  }

  return (
    <LocalAttachmentChip
      key={att.id}
      name={att.name}
      contentType={att.contentType ?? 'application/octet-stream'}
      size={att.size}
      onOpen={(): void => void handleOpen(att)}
      onRemove={(): void => void handleRemove(att.id)}
      onSaveAs={(): void => void handleSaveAs(att)}
      saveAsLabel={t('notes.attachments.saveAs')}
      removeAriaLabel={t('notes.attachments.remove')}
      compact
    />
  )
}

export function NotesAttachmentsPanel({
  noteId,
  className,
  variant = 'card',
  onCreateSubPage,
  createSubPageDisabled = false
}: {
  noteId: number
  className?: string
  variant?: 'card' | 'onenote'
  onCreateSubPage?: () => void
  createSubPageDisabled?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const microsoftAccount = accounts.find((a) => a.provider === 'microsoft')

  const [items, setItems] = useState<UserNoteAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [driveOpen, setDriveOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }): Promise<void> => {
    if (!opts?.silent) setLoading(true)
    try {
      setItems(await window.mailClient.notes.attachments.list(noteId))
    } catch {
      setItems([])
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsub = window.mailClient.events.onNotesChanged((detail) => {
      if (detail.noteId != null && detail.noteId !== noteId) return
      if (detail.scope != null && detail.scope !== 'attachments') return
      void load({ silent: true })
    })
    return unsub
  }, [load, noteId])

  const handleFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const result = await uploadFilesToNote(noteId, files)
      if (!result.ok) {
        setError(result.error)
        return
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (attachmentId: number): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.mailClient.notes.attachments.remove({ noteId, attachmentId })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleOpen = async (att: UserNoteAttachment): Promise<void> => {
    if (isPlayableAudioAttachment(att)) return
    const res = await window.mailClient.notes.attachments.open({
      noteId,
      attachmentId: att.id
    })
    if (!res.ok && res.error) setError(res.error)
  }

  const handleSaveAs = async (att: UserNoteAttachment): Promise<void> => {
    const res = await window.mailClient.notes.attachments.saveAs({
      noteId,
      attachmentId: att.id,
      suggestedName: att.name
    })
    if (!res.ok && !res.cancelled && res.error) setError(res.error)
  }

  const handleCloudPick = async (file: { name: string; webUrl: string }): Promise<void> => {
    setDriveOpen(false)
    setBusy(true)
    setError(null)
    try {
      await window.mailClient.notes.attachments.addCloud({
        noteId,
        name: file.name,
        sourceUrl: file.webUrl,
        providerType: 'oneDriveBusiness'
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const embedded = variant === 'onenote'

  const actionButtons = (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={(): void => fileInputRef.current?.click()}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary disabled:opacity-50',
          embedded && 'text-xs'
        )}
      >
        <Paperclip className="h-3 w-3" />
        {t('notes.attachments.addFile')}
      </button>
      <NoteAudioRecorder noteId={noteId} disabled={busy} onError={setError} onAdded={(): void => void load({ silent: true })} />
      {microsoftAccount ? (
        <button
          type="button"
          disabled={busy}
          onClick={(): void => setDriveOpen(true)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/5 px-2 py-1 text-2xs font-medium text-foreground hover:bg-sky-500/10 disabled:opacity-50',
            embedded && 'text-xs'
          )}
        >
          <Cloud className="h-3 w-3 text-sky-600 dark:text-sky-400" />
          {t('notes.attachments.addCloud')}
        </button>
      ) : null}
      {onCreateSubPage ? (
        <button
          type="button"
          disabled={busy || createSubPageDisabled}
          onClick={onCreateSubPage}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary disabled:opacity-50',
            embedded && 'text-xs'
          )}
        >
          <FilePlus2 className="h-3 w-3" />
          {t('notes.subPages.create')}
        </button>
      ) : null}
    </div>
  )

  const attachmentItems = items.map((att) =>
    att.kind === 'cloud' ? (
      <CloudAttachmentChip
        key={att.id}
        name={att.name}
        onOpen={(): void => void handleOpen(att)}
        onRemove={(): void => void handleRemove(att.id)}
        onOpenLink={(): void => void handleOpen(att)}
        openLinkLabel={t('notes.attachments.openLink')}
        removeAriaLabel={t('notes.attachments.remove')}
      />
    ) : (
      renderLocalAttachment(att, noteId, t, handleOpen, handleRemove, handleSaveAs, setError)
    )
  )

  const body = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e): void => {
          const list = e.target.files
          if (list?.length) void handleFiles(Array.from(list))
          e.target.value = ''
        }}
      />

      {error ? (
        <div className="mb-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('notes.attachments.empty')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">{attachmentItems}</div>
      )}

      {microsoftAccount ? (
        <OneDriveExplorerDialog
          open={driveOpen}
          accountId={microsoftAccount.id}
          configureSharingLink={false}
          onClose={(): void => setDriveOpen(false)}
          onPickFile={(file): void => void handleCloudPick(file)}
        />
      ) : null}

      {!microsoftAccount && items.length === 0 ? (
        <p className="mt-1 text-2xs text-muted-foreground">{t('notes.attachments.cloudRequiresM365')}</p>
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <div className={cn('space-y-2', className)}>
        {error ? (
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('notes.attachments.empty')}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">{attachmentItems}</div>
            )}
          </div>
          <div className="shrink-0">{actionButtons}</div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e): void => {
            const list = e.target.files
            if (list?.length) void handleFiles(Array.from(list))
            e.target.value = ''
          }}
        />

        {microsoftAccount ? (
          <OneDriveExplorerDialog
            open={driveOpen}
            accountId={microsoftAccount.id}
            configureSharingLink={false}
            onClose={(): void => setDriveOpen(false)}
            onPickFile={(file): void => void handleCloudPick(file)}
          />
        ) : null}

        {!microsoftAccount && items.length === 0 ? (
          <p className="text-2xs text-muted-foreground">{t('notes.attachments.cloudRequiresM365')}</p>
        ) : null}
      </div>
    )
  }

  return (
    <section className={cn('rounded-lg border border-border bg-card/40 px-3 py-2.5', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          {t('notes.attachments.title')}
          {loading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
        </div>
        {actionButtons}
      </div>
      {body}
    </section>
  )
}
