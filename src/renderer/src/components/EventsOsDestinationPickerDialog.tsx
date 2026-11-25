import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Search, X } from 'lucide-react'
import type { EventsOsEventHit, EventsOsInboxKind } from '@shared/types/events-os'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import {
  groupEventsOsHits,
  loadEventsOsGroupMode,
  saveEventsOsGroupMode,
  type EventsOsGroupMode
} from '@/lib/events-os-hit-groups'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { useEventsOsDestinationPickerStore } from '@/stores/events-os-destination-picker'

const KIND_OPTIONS: EventsOsInboxKind[] = [
  'sonstiges',
  'email_abmeldung',
  'email_anmeldung',
  'email_anfrage',
  'honorar',
  'anwesenheit',
  'angebot',
  'note'
]

const GROUP_MODES: EventsOsGroupMode[] = ['zeitraum', 'monat', 'organisation']

function formatHitDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('de-AT', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch {
    return iso
  }
}

export function EventsOsDestinationPickerDialog(): JSX.Element | null {
  const { t } = useTranslation()
  const open = useEventsOsDestinationPickerStore((s) => s.open)
  const suggestedQuery = useEventsOsDestinationPickerStore((s) => s.suggestedQuery)
  const subject = useEventsOsDestinationPickerStore((s) => s.subject)
  const close = useEventsOsDestinationPickerStore((s) => s.close)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<EventsOsEventHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [kind, setKind] = useState<EventsOsInboxKind>('sonstiges')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [groupMode, setGroupMode] = useState<EventsOsGroupMode>(() => loadEventsOsGroupMode())

  const search = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.mailClient.eventsOs.searchEvents(q, 25)
      if (!res.ok) throw new Error(res.error || 'Suche fehlgeschlagen')
      setHits(res.hits || [])
      setHint(res.hint || null)
    } catch (err) {
      setHits([])
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const q = suggestedQuery || ''
    setQuery(q)
    setBusyId(null)
    setKind(
      /abmeldung|storno|absage|cancel/i.test(subject)
        ? 'email_abmeldung'
        : /anmeldung/i.test(subject)
          ? 'email_anmeldung'
          : 'sonstiges'
    )
    void search(q)
  }, [open, suggestedQuery, subject, search])

  const groups = useMemo(
    () => groupEventsOsHits(hits, groupMode),
    [hits, groupMode]
  )

  function onGroupModeChange(mode: EventsOsGroupMode): void {
    setGroupMode(mode)
    saveEventsOsGroupMode(mode)
  }

  if (!open) return null

  return (
    <ModalRoot open={open} onBackdropClick={(): void => close(null)}>
      <ModalPanel
        className={cn(
          'flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden',
          listSubtleBorderClass,
          'bg-background shadow-xl'
        )}
        aria-modal="true"
        aria-labelledby="events-os-picker-title"
        onClick={(e): void => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="events-os-picker-title" className="text-sm font-semibold">
              {t('eventsOs.pickerTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('eventsOs.pickerHint')}
            </p>
            {subject ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{subject}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
            onClick={(): void => close(null)}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-2 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">
              {t('eventsOs.kindLabel')}
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={kind}
                onChange={(e): void => setKind(e.target.value as EventsOsInboxKind)}
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {t(`eventsOs.kind.${k}`, { defaultValue: k })}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              {t('eventsOs.groupLabel')}
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={groupMode}
                onChange={(e): void =>
                  onGroupModeChange(e.target.value as EventsOsGroupMode)
                }
              >
                {GROUP_MODES.map((m) => (
                  <option key={m} value={m}>
                    {t(`eventsOs.group.${m}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={query}
              onChange={(e): void => setQuery(e.target.value)}
              placeholder={t('eventsOs.searchPlaceholder')}
              onKeyDown={(e): void => {
                if (e.key === 'Enter') void search(query)
              }}
            />
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm"
              disabled={loading}
              onClick={(): void => {
                void search(query)
              }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {t('common.search', { defaultValue: 'Suchen' })}
            </button>
          </div>
          {hint ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">{hint}</p>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {groups.map((group) => (
            <section key={group.key} className="py-1">
              <p className="sticky top-0 z-[1] bg-background/95 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                {group.label}
                <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
                  ({group.items.length})
                </span>
              </p>
              <ul className="space-y-0.5">
                {group.items.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      disabled={busyId != null}
                      className={cn(
                        'flex w-full flex-col rounded-md px-2 py-2 text-left text-sm',
                        'hover:bg-secondary/80 disabled:opacity-50',
                        busyId === h.id && 'bg-secondary/80'
                      )}
                      onClick={(): void => {
                        setBusyId(h.id)
                        close({
                          eventId: h.id,
                          title: h.title,
                          kind,
                          studioAkteUrl: h.studioAkteUrl
                        })
                      }}
                    >
                      <span className="font-medium leading-snug">{h.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatHitDate(h.date)}
                        {h.category?.length ? ` · ${h.category.join(', ')}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!loading && hits.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              {t('eventsOs.pickerEmpty')}
            </p>
          ) : null}
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
