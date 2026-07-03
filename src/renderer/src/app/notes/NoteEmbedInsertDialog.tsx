import type { KeyboardEvent, MutableRefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppWindow, Loader2, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/react'
import {
  NOTE_EMBED_PROVIDER_URL_HINTS,
  findNoteEmbedProviderForUrl,
  getNoteEmbedProviderLabel,
  listNoteEmbedProviders,
  noteEmbedUrlLooksInsertable,
  type NoteEmbedProviderId
} from '@shared/note-embed-insert'
import { insertNoteEmbedInEditor, resolveNoteEmbedInsertTarget } from '@/lib/note-embed-insert'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { cn } from '@/lib/utils'

export function NoteEmbedInsertDialog({
  open,
  editorRef,
  onClose,
  onInserted,
  onChangeHtml,
  onError
}: {
  open: boolean
  editorRef: MutableRefObject<Editor | null>
  onClose: () => void
  onInserted: () => void
  onChangeHtml?: (html: string) => void
  onError?: (message: string) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const urlInputRef = useRef<HTMLInputElement>(null)
  const providers = useMemo(() => listNoteEmbedProviders(), [])

  const [url, setUrl] = useState('')
  const [providerQuery, setProviderQuery] = useState('')
  const [selectedProviderId, setSelectedProviderId] = useState<NoteEmbedProviderId | null>(null)
  const [inserting, setInserting] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setUrl('')
    setProviderQuery('')
    setSelectedProviderId(null)
    setResolveError(null)
    window.setTimeout(() => urlInputRef.current?.focus(), 0)
  }, [open])

  const detectedProviderId = useMemo(() => findNoteEmbedProviderForUrl(url), [url])

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase()
    if (!q) return providers
    return providers.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) || entry.id.toLowerCase().includes(q.replace(/\s+/g, ''))
    )
  }, [providerQuery, providers])

  const selectedHint =
    (selectedProviderId && NOTE_EMBED_PROVIDER_URL_HINTS[selectedProviderId]) ||
    (detectedProviderId && NOTE_EMBED_PROVIDER_URL_HINTS[detectedProviderId]) ||
    null

  const canInsert = noteEmbedUrlLooksInsertable(url) && !inserting

  const handleInsert = useCallback(async (): Promise<void> => {
    const editor = editorRef.current
    if (!editor || editor.isDestroyed) return
    const trimmed = url.trim()
    if (!trimmed) return

    setInserting(true)
    setResolveError(null)
    try {
      const target = await resolveNoteEmbedInsertTarget(trimmed)
      if (!target) {
        setResolveError(t('notes.embedInsert.unsupportedUrl'))
        return
      }
      const ok = insertNoteEmbedInEditor(editor, target, onChangeHtml)
      if (!ok) {
        onError?.(t('notes.embedInsert.insertFailed'))
        return
      }
      onInserted()
      onClose()
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e))
    } finally {
      setInserting(false)
    }
  }, [editorRef, onChangeHtml, onClose, onError, onInserted, t, url])

  if (!open) return null

  return (
    <ModalRoot open zIndex={320} overlayClassName="p-4" onBackdropClick={onClose}>
      <ModalPanel
        className="chronell-dialog-panel flex max-h-[min(560px,92vh)] w-full max-w-lg flex-col overflow-hidden text-popover-foreground"
        aria-labelledby="note-embed-insert-title"
      >
        <div
          className="flex min-h-0 flex-1 flex-col"
          onKeyDown={(event: KeyboardEvent): void => {
            if (event.key === 'Enter' && canInsert && event.target === urlInputRef.current) {
              event.preventDefault()
              void handleInsert()
            }
          }}
        >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="note-embed-insert-title" className="text-sm font-semibold">
              {t('notes.embedInsert.title')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('notes.embedInsert.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="space-y-1.5">
            <label htmlFor="note-embed-url" className="text-xs font-medium">
              {t('notes.embedInsert.urlLabel')}
            </label>
            <input
              id="note-embed-url"
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={(event): void => {
                setUrl(event.target.value)
                setResolveError(null)
              }}
              placeholder={t('notes.embedInsert.urlPlaceholder')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            {detectedProviderId ? (
              <p className="text-xs text-muted-foreground">
                {t('notes.embedInsert.detectedProvider', {
                  provider: getNoteEmbedProviderLabel(detectedProviderId)
                })}
              </p>
            ) : url.trim() ? (
              <p className="text-xs text-muted-foreground">{t('notes.embedInsert.pasteHint')}</p>
            ) : null}
            {resolveError ? (
              <p className="text-xs text-destructive" role="alert">
                {resolveError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="note-embed-provider-search" className="text-xs font-medium">
              {t('notes.embedInsert.providerSearchLabel')}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="note-embed-provider-search"
                type="search"
                value={providerQuery}
                onChange={(event): void => setProviderQuery(event.target.value)}
                placeholder={t('notes.embedInsert.providerSearchPlaceholder')}
                className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm"
              />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-md border border-border p-1">
              {filteredProviders.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  {t('notes.embedInsert.noProviders')}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {filteredProviders.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={(): void => {
                          setSelectedProviderId(entry.id)
                          setProviderQuery('')
                        }}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          selectedProviderId === entry.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-muted'
                        )}
                      >
                        {entry.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedHint ? (
              <p className="text-xs text-muted-foreground">
                {t('notes.embedInsert.exampleUrl', { url: selectedHint })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('notes.embedInsert.providerSearchHint')}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!canInsert || !editorRef.current}
            onClick={(): void => {
              void handleInsert()
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {inserting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            <AppWindow className="h-3.5 w-3.5" aria-hidden />
            {t('notes.embedInsert.insert')}
          </button>
        </div>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
