import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Loader2, Search, X } from 'lucide-react'
import type { MsFormListItem } from '@shared/types'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

export function MsFormsPickerDialog({
  open,
  accountId,
  onClose,
  onPick
}: {
  open: boolean
  accountId: string
  onClose: () => void
  onPick: (form: MsFormListItem) => void
}): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [forms, setForms] = useState<MsFormListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!accountId.trim()) {
      setError(t('calendar.msFormsPicker.noAccount'))
      setForms([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await window.mailClient.msForms.listMine({ accountId })
      setForms(rows)
    } catch (e) {
      setForms([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [accountId, t])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setForms([])
    setError(null)
    void load()
    const tmr = window.setTimeout(() => inputRef.current?.focus(), 50)
    return (): void => window.clearTimeout(tmr)
  }, [open, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return forms
    return forms.filter((f) => f.title.toLowerCase().includes(q))
  }, [forms, query])

  if (!open) return null

  return (
    <ModalRoot
      open={open}
      zIndex={320}
      centerClassName="items-start justify-center bg-black/55 pt-[12vh]"
      onBackdropClick={onClose}
    >
      <ModalPanel
        aria-labelledby="msforms-picker-title"
        className="app-dialog-panel flex max-h-[min(520px,78vh)] w-[min(440px,94vw)] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
      >
        <div className={cn('flex items-start justify-between gap-2 border-b px-3 py-2.5', listSubtleBorderClass)}>
          <div className="min-w-0">
            <h2 id="msforms-picker-title" className="text-sm font-semibold text-foreground">
              {t('calendar.msFormsPicker.title')}
            </h2>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {t('calendar.msFormsPicker.subtitle')}
            </p>
          </div>
          <button
            type="button"
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
              onChange={(e): void => setQuery(e.target.value)}
              placeholder={t('calendar.msFormsPicker.searchPlaceholder')}
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
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('calendar.msFormsPicker.loading')}
            </div>
          ) : null}
          {!loading && filtered.length === 0 && !error ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              {t('calendar.msFormsPicker.empty')}
            </p>
          ) : null}
          <ul>
            {filtered.map((form) => {
              const modified =
                form.modifiedDate && !Number.isNaN(Date.parse(form.modifiedDate))
                  ? new Intl.DateTimeFormat(i18n.language, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    }).format(new Date(form.modifiedDate))
                  : null
              return (
                <li key={form.id} className={listSubtleBorderClass}>
                  <button
                    type="button"
                    onClick={(): void => {
                      onPick(form)
                      onClose()
                    }}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/70"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">
                        {form.title}
                      </span>
                      {modified ? (
                        <span className="mt-0.5 block text-2xs text-muted-foreground">
                          {t('calendar.msFormsPicker.modified', { date: modified })}
                        </span>
                      ) : null}
                    </span>
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
