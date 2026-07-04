import { useEffect, useMemo, useRef, useState } from 'react'
import { addHours, format } from 'date-fns'
import { Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount } from '@shared/types'
import { cloudTaskAccountOptionLabel } from '@/lib/cloud-task-accounts'
import { isoToDatetimeLocalValue } from '@/app/work-items/work-item-datetime'
import { useFilesContextUiStore } from '@/stores/files-context-ui'
import { useUndoStore } from '@/stores/undo'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

function calendarLinkedAccounts(accounts: ConnectedAccount[]): ConnectedAccount[] {
  return accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google')
}

export function FilesCreateCalendarEventDialog({
  accounts
}: {
  accounts: ConnectedAccount[]
}): JSX.Element | null {
  const { t } = useTranslation()
  const pushToast = useUndoStore((s) => s.pushToast)
  const initial = useFilesContextUiStore((s) => s.createCalendarInitial)
  const close = useFilesContextUiStore((s) => s.closeCreateCalendar)
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
    if (!initial) return
    const first =
      (initial.accountId && linkedAccounts.some((a) => a.id === initial.accountId)
        ? initial.accountId
        : linkedAccounts[0]?.id) ?? ''
    setAccountId(first)
    setSubject(initial.subject.trim())
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
  }, [initial, linkedAccounts])

  async function handleSubmit(): Promise<void> {
    if (!initial || !accountId || !subject.trim()) return
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
          setError(t('calendar.eventDialog.invalidDate'))
          return
        }
        startIso = start.toISOString()
        endIso = end.toISOString()
      }
      await window.mailClient.calendar.createEvent({
        accountId,
        subject: subject.trim(),
        startIso,
        endIso,
        isAllDay,
        location: location.trim() || null,
        attachments:
          initial.attachments?.map((a) => ({
            name: a.name,
            contentType: a.contentType,
            size: a.size,
            dataBase64: a.dataBase64
          })) ?? null,
        referenceAttachments:
          initial.referenceAttachments?.map((a) => ({
            name: a.name,
            sourceUrl: a.sourceUrl,
            providerType: 'oneDriveBusiness' as const
          })) ?? null
      })
      pushToast({ label: t('files.context.eventCreated'), variant: 'success' })
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!initial) return null

  return (
    <ModalRoot open onBackdropClick={close} zIndex={320} overlayClassName="p-4">
      <ModalPanel
        className="flex w-full max-w-md flex-col"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="min-w-0 flex-1 text-sm font-semibold">{t('files.context.createEvent')}</h2>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={close}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="space-y-3 p-4"
          onSubmit={(e): void => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <label className="block text-xs text-muted-foreground">
            {t('files.sidebar.accounts')}
            <select
              value={accountId}
              onChange={(e): void => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {linkedAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {cloudTaskAccountOptionLabel(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">
            {t('calendar.eventDialog.titleAria')}
            <input
              ref={subjectInputRef}
              value={subject}
              onChange={(e): void => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e): void => setIsAllDay(e.target.checked)}
            />
            {t('calendar.eventDialog.allDay')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">
              {t('calendar.eventDialog.editStartDateAria')}
              <input
                type={isAllDay ? 'date' : 'datetime-local'}
                value={isAllDay ? startLocal.slice(0, 10) : startLocal}
                onChange={(e): void => setStartLocal(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              {t('calendar.eventDialog.editEndDateAria')}
              <input
                type={isAllDay ? 'date' : 'datetime-local'}
                value={isAllDay ? endLocal.slice(0, 10) : endLocal}
                onChange={(e): void => setEndLocal(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">
            {t('notes.calendarEvent.location')}
            <input
              value={location}
              onChange={(e): void => setLocation(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              onClick={close}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy || !subject.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('common.create')}
            </button>
          </div>
        </form>
      </ModalPanel>
    </ModalRoot>
  )
}
