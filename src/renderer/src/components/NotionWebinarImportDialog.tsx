import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Loader2, Search, X } from 'lucide-react'
import type { NotionKurtrocksEventHit, NotionWebinarImportResult } from '@shared/types'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

function formatHitDate(hit: NotionKurtrocksEventHit, locale: string): string {
  if (!hit.startIso) return ''
  try {
    const start = new Date(hit.startIso)
    if (Number.isNaN(start.getTime())) return hit.startIso
    if (hit.isAllDay) {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(start)
    }
    const end = hit.endIso ? new Date(hit.endIso) : null
    const day = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(start)
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
    if (end && !Number.isNaN(end.getTime())) {
      return `${day} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`
    }
    return `${day} · ${timeFmt.format(start)}`
  } catch {
    return hit.startIso
  }
}

export function NotionWebinarImportDialog({
  open,
  onClose,
  onImported
}: {
  open: boolean
  onClose: () => void
  onImported: (result: NotionWebinarImportResult) => void
}): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<NotionKurtrocksEventHit[]>([])
  const [loading, setLoading] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchSeq = useRef(0)

  const runSearch = useCallback(async (q: string): Promise<void> => {
    const seq = ++searchSeq.current
    setLoading(true)
    setError(null)
    try {
      const next = await window.mailClient.notion.searchKurtrocksEvents(q)
      if (seq !== searchSeq.current) return
      setHits(next)
    } catch (e) {
      if (seq !== searchSeq.current) return
      setHits([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (seq === searchSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHits([])
    setError(null)
    setImportingId(null)
    void runSearch('')
    const tmr = window.setTimeout(() => inputRef.current?.focus(), 50)
    return (): void => window.clearTimeout(tmr)
  }, [open, runSearch])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void runSearch(query)
    }, 280)
    return (): void => window.clearTimeout(handle)
  }, [query, open, runSearch])

  const handlePick = useCallback(
    async (pageId: string): Promise<void> => {
      setImportingId(pageId)
      setError(null)
      try {
        const result = await window.mailClient.notion.importKurtrocksEventForWebinar(pageId)
        onImported(result)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setImportingId(null)
      }
    },
    [onClose, onImported]
  )

  if (!open) return null

  const busy = loading || importingId != null

  return (
    <ModalRoot
      open={open}
      zIndex={300}
      centerClassName="items-start justify-center bg-black/55 pt-[12vh]"
      onBackdropClick={(): void => {
        if (!importingId) onClose()
      }}
    >
      <ModalPanel
        aria-labelledby="notion-webinar-import-title"
        className="app-dialog-panel flex max-h-[min(560px,80vh)] w-[min(480px,94vw)] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
      >
        <div className={cn('flex items-start justify-between gap-2 border-b px-3 py-2.5', listSubtleBorderClass)}>
          <div className="min-w-0">
            <h2 id="notion-webinar-import-title" className="text-sm font-semibold text-foreground">
              {t('calendar.notionWebinarImport.title')}
            </h2>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {t('calendar.notionWebinarImport.subtitle')}
            </p>
          </div>
          <button
            type="button"
            disabled={importingId != null}
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn('border-b px-3 py-2', listSubtleBorderClass)}>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              disabled={importingId != null}
              onChange={(e): void => setQuery(e.target.value)}
              placeholder={t('calendar.notionWebinarImport.searchPlaceholder')}
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="px-4 py-3 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {loading && hits.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('calendar.notionWebinarImport.loading')}
            </div>
          ) : null}
          {!loading && hits.length === 0 && !error ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              {t('calendar.notionWebinarImport.empty')}
            </p>
          ) : null}
          <ul>
            {hits.map((hit) => {
              const importing = importingId === hit.id
              const dateLabel = formatHitDate(hit, i18n.language)
              return (
                <li key={hit.id} className={listSubtleBorderClass}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(): void => {
                      void handlePick(hit.id)
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                      busy && !importing ? 'opacity-50' : 'hover:bg-secondary/70',
                      importing && 'bg-primary/10'
                    )}
                  >
                    {hit.coverUrl ? (
                      <img
                        src={hit.coverUrl}
                        alt=""
                        className="mt-0.5 h-10 w-14 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="mt-0.5 flex h-10 w-14 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">
                        {hit.title}
                      </span>
                      {dateLabel ? (
                        <span className="mt-0.5 block text-2xs text-muted-foreground">{dateLabel}</span>
                      ) : null}
                      {hit.descriptionPreview ? (
                        <span className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground/80">
                          {hit.descriptionPreview}
                        </span>
                      ) : null}
                    </span>
                    {importing ? (
                      <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
