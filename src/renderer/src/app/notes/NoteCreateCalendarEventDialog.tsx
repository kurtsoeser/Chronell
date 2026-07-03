import { useEffect, useMemo, useRef, useState } from 'react'
import { addHours, format } from 'date-fns'
import { Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount } from '@shared/types'
import { cloudTaskAccountOptionLabel } from '@/lib/cloud-task-accounts'
import { createAndLinkNoteCalendarEvent } from '@/lib/note-entity-mention-insert'
import { isoToDatetimeLocalValue } from '@/app/work-items/work-item-datetime'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

function calendarLinkedAccounts(accounts: ConnectedAccount[]): ConnectedAccount[] {
  return accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google')
}

export interface NoteCreateCalendarEventDialogProps {
  open: boolean
  noteId: number | null
  initialSubject?: string
  accounts: ConnectedAccount[]
  onClose: () => void
  onCreated: (html: string) => void
  onLinkAdded?: () => void
  onError?: (message: string) => void
}

export function NoteCreateCalendarEventDialog({
  open,
  noteId,
  initialSubject = '',
  accounts,
  onClose,
  onCreated,
  onLinkAdded,
  onError
}: NoteCreateCalendarEventDialogProps): JSX.Element | null {
  const { t } = useTranslation()
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const linkedAccounts = useMemo(() => calendarLinkedAccounts(accounts), [accounts])

  const [accountId, setAccountId] = useState('')
  const [subject, setSubject] = useState('')
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [isAllDay, setIsAllDay] = useState(false)
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const first = linkedAccounts[0]?.id ?? ''
    setAccountId(first)
    setSubject(initialSubject.trim())
    const start = new Date()
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
    const end = addHours(start, 1)
    setStartLocal(isoToDatetimeLocalValue(start.toISOString()))
    setEndLocal(isoToDatetimeLocalValue(end.toISOString()))
    setIsAllDay(false)
    setLocation('')
    setError(null)
    window.setTimeout(() => subjectInputRef.current?.focus(), 0)
  }, [initialSubject, open, linkedAccounts])

  async function handleSubmit(): Promise<void> {
    if (!noteId || !accountId || !subject.trim()) return
    setBusy(true)
    setError(null)
    try {
      let startIso: string
      let endIso: string
      if (isAllDay) {
        const day = startLocal.slice(0, 10) || format(new Date(), 'yyyy-MM-dd')
        startIso = day
        endIso = day
      } else {
        const start = new Date(startLocal)
        const end = new Date(endLocal)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          throw new Error(t('notes.calendarEvent.invalidRange'))
        }
        startIso = start.toISOString()
        endIso = end.toISOString()
      }
      const { html } = await createAndLinkNoteCalendarEvent({
        noteId,
        accountId,
        subject: subject.trim(),
        startIso,
        endIso,
        isAllDay,
        location: location.trim() || null
      })
      onLinkAdded?.()
      onCreated(html)
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      onError?.(message)
    } finally {
      setBusy(false)
    }
  }

  const noAccounts = linkedAccounts.length === 0

  return (
    <ModalRoot open={open} zIndex={100} centerClassName="items-center justify-center" onBackdropClick={onClose}>
      <ModalPanel className="flex max-h-[min(90vh,640px)] w-[480px] max-w-[92vw] flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">{t('notes.calendarEvent.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {noAccounts ? (
            <p className="text-sm text-muted-foreground">{t('notes.calendarEvent.noAccounts')}</p>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('notes.meetingInsert.account')}</span>
                <select
                  value={accountId}
                  onChange={(e): void => setAccountId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                >
                  {linkedAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {cloudTaskAccountOptionLabel(a)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('notes.calendarEvent.subject')}</span>
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={subject}
                  onChange={(e): void => setSubject(e.target.value)}
                  onKeyDown={(e): void => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSubmit()
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e): void => setIsAllDay(e.target.checked)}
                />
                {t('notes.calendarEvent.allDay')}
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('notes.calendarEvent.start')}</span>
                  <input
                    type={isAllDay ? 'date' : 'datetime-local'}
                    value={isAllDay ? startLocal.slice(0, 10) : startLocal}
                    onChange={(e): void => setStartLocal(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('notes.calendarEvent.end')}</span>
                  <input
                    type={isAllDay ? 'date' : 'datetime-local'}
                    value={isAllDay ? endLocal.slice(0, 10) : endLocal}
                    onChange={(e): void => setEndLocal(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('notes.calendarEvent.location')}</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e): void => setLocation(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </label>
            </>
          )}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || noAccounts || !subject.trim() || !noteId}
            onClick={(): void => void handleSubmit()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {t('notes.calendarEvent.create')}
          </button>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
