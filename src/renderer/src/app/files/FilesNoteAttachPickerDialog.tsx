import { useCallback, useEffect, useState } from 'react'
import { Loader2, StickyNote, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNoteListItem } from '@shared/types'
import { useFilesContextUiStore } from '@/stores/files-context-ui'
import { useUndoStore } from '@/stores/undo'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

function base64ByteLength(dataBase64: string): number {
  const pad = dataBase64.endsWith('==') ? 2 : dataBase64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((dataBase64.length * 3) / 4) - pad)
}

export function FilesNoteAttachPickerDialog(): JSX.Element | null {
  const { t } = useTranslation()
  const pushToast = useUndoStore((s) => s.pushToast)
  const target = useFilesContextUiStore((s) => s.noteAttachTarget)
  const close = useFilesContextUiStore((s) => s.closeNoteAttach)
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState<UserNoteListItem[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    if (!target) return
    setSearch('')
    setNotes([])
  }, [target])

  useEffect(() => {
    if (!target) return
    const handle = window.setTimeout(() => {
      void window.mailClient.notes
        .search({ query: search.trim(), kinds: ['standalone'], limit: 40 })
        .then(setNotes)
        .catch(() => setNotes([]))
    }, 150)
    return (): void => window.clearTimeout(handle)
  }, [target, search])

  const attach = useCallback(
    async (noteId: number): Promise<void> => {
      if (!target) return
      setBusyId(noteId)
      try {
        if (target.source === 'mail') {
          const data = await window.mailClient.files.readMailAttachmentBytes({
            fileId: target.row.id
          })
          if (!data.ok || !data.dataBase64) {
            pushToast({ label: data.error ?? t('files.context.attachFailed'), variant: 'error' })
            return
          }
          await window.mailClient.notes.attachments.addLocal({
            noteId,
            name: data.name ?? target.row.name,
            contentType: data.contentType ?? target.row.mime ?? 'application/octet-stream',
            size: base64ByteLength(data.dataBase64),
            dataBase64: data.dataBase64
          })
        } else {
          const row = target.row
          if (row.cloudProvider === 'microsoft' && row.webUrl) {
            await window.mailClient.notes.attachments.addCloud({
              noteId,
              name: row.name,
              sourceUrl: row.webUrl,
              providerType: 'oneDriveBusiness'
            })
          } else {
            const data = await window.mailClient.files.readCloudItemBytes({
              accountId: row.accountId,
              itemId: row.itemId,
              driveId: row.driveId
            })
            if (!data.ok || !data.dataBase64) {
              pushToast({ label: data.error ?? t('files.context.attachFailed'), variant: 'error' })
              return
            }
            await window.mailClient.notes.attachments.addLocal({
              noteId,
              name: data.name ?? row.name,
              contentType: data.contentType ?? row.mime ?? 'application/octet-stream',
              size: base64ByteLength(data.dataBase64),
              dataBase64: data.dataBase64
            })
          }
        }
        pushToast({ label: t('files.context.addedToNote'), variant: 'success' })
        close()
      } catch (e) {
        pushToast({
          label: e instanceof Error ? e.message : String(e),
          variant: 'error'
        })
      } finally {
        setBusyId(null)
      }
    },
    [close, pushToast, t, target]
  )

  if (!target) return null

  return (
    <ModalRoot open onBackdropClick={close} zIndex={320} overlayClassName="p-4">
      <ModalPanel
        className="flex max-h-[min(80vh,560px)] w-full max-w-md flex-col"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <StickyNote className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="min-w-0 flex-1 text-sm font-semibold">{t('files.context.addToNote')}</h2>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={close}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-border px-4 py-2">
          <input
            type="search"
            value={search}
            onChange={(e): void => setSearch(e.target.value)}
            placeholder={t('notes.mailInsert.searchPlaceholder')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {notes.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">{t('notes.mailInsert.noNotes')}</p>
          ) : (
            <ul className="space-y-1">
              {notes.map((note) => {
                const title = note.title?.trim() || t('notes.shell.untitled')
                const busy = busyId === note.id
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(): void => void attach(note.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                        busy && 'opacity-70'
                      )}
                    >
                      <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{title}</span>
                      {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
