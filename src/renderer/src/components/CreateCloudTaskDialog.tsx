import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarRecurrenceRangeEndMode,
  ConnectedAccount,
  TaskListRow
} from '@shared/types'
import { CalendarEventRecurrenceSection } from '@/app/calendar/CalendarEventRecurrenceSection'
import {
  buildTaskSaveRecurrence,
  defaultWeekdayFromDueYmd,
  type TaskRecurrenceUiFrequency,
  validateTaskRecurrenceForm
} from '@/lib/task-recurrence-form'
import { dueIsoFromClientInput } from '@shared/calendar-datetime'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import {
  datetimeLocalValueToIso,
  isoToDatetimeLocalValue
} from '@/app/work-items/work-item-datetime'
import { persistTasksCalendarCreateAccountId } from '@/app/tasks/tasks-calendar-create-storage'
import {
  pickDefaultListId,
  resolvePreferredAccountId,
  resolvePreferredListId
} from '@/app/tasks/tasks-create-defaults'
import {
  scheduleFromCalendarCreateRange,
  type CalendarCreateRange
} from '@/app/tasks/tasks-calendar-create-range'
import type { TaskItemWithContext, TasksViewSelection } from '@/app/tasks/tasks-types'
import { cloudTaskAccountOptionLabel } from '@/lib/cloud-task-accounts'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

export interface CreateCloudTaskDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (task: TaskItemWithContext) => void
  taskAccounts: ConnectedAccount[]
  selection: TasksViewSelection | null
  loadListsForAccount: (accountId: string) => Promise<TaskListRow[]>
  initialRange?: CalendarCreateRange | null
  /** Beim Oeffnen dieses Kontos vorschlagen (z. B. Kontextmenue auf Konto-Zeile). */
  preferredAccountIdOnOpen?: string | null
}

export function CreateCloudTaskDialog({
  open,
  onClose,
  onCreated,
  taskAccounts,
  selection,
  loadListsForAccount,
  initialRange,
  preferredAccountIdOnOpen
}: CreateCloudTaskDialogProps): JSX.Element | null {
  const { t } = useTranslation()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [accountId, setAccountId] = useState('')
  const [listId, setListId] = useState('')
  const [lists, setLists] = useState<TaskListRow[]>([])
  const [listsLoading, setListsLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [due, setDue] = useState('')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recurFreq, setRecurFreq] = useState<TaskRecurrenceUiFrequency>('none')
  const [recurEnd, setRecurEnd] = useState<CalendarRecurrenceRangeEndMode>('never')
  const [recurUntilDate, setRecurUntilDate] = useState('')
  const [recurCount, setRecurCount] = useState('10')
  const [recurWeekdays, setRecurWeekdays] = useState<
    Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>
  >([])

  useEffect(() => {
    if (!open) return
    const accId =
      preferredAccountIdOnOpen && taskAccounts.some((a) => a.id === preferredAccountIdOnOpen)
        ? preferredAccountIdOnOpen
        : resolvePreferredAccountId(taskAccounts, selection)
    setAccountId(accId)
    setTitle('')
    setNotes('')
    setError(null)
    setRecurFreq('none')
    setRecurEnd('never')
    setRecurUntilDate('')
    setRecurCount('10')
    setRecurWeekdays([])
    if (initialRange) {
      const sched = scheduleFromCalendarCreateRange(initialRange, timeZone)
      setDue(sched.dueDate)
      setPlannedStart(isoToDatetimeLocalValue(sched.plannedStartIso))
      setPlannedEnd(isoToDatetimeLocalValue(sched.plannedEndIso))
    } else {
      setDue('')
      setPlannedStart('')
      setPlannedEnd('')
    }
    window.setTimeout(() => titleInputRef.current?.focus(), 0)
  }, [open, initialRange, selection, taskAccounts, timeZone, preferredAccountIdOnOpen])

  useEffect(() => {
    if (!open || !accountId) {
      setLists([])
      setListId('')
      return
    }
    let cancelled = false
    setListsLoading(true)
    void loadListsForAccount(accountId)
      .then((rows) => {
        if (cancelled) return
        setLists(rows)
        setListId(resolvePreferredListId(selection, accountId, rows))
      })
      .catch((e) => {
        if (cancelled) return
        setLists([])
        setListId('')
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setListsLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [open, accountId, loadListsForAccount, selection])

  if (!open) return null

  const noTaskAccounts = taskAccounts.length === 0
  const canSubmit =
    !noTaskAccounts &&
    accountId &&
    listId &&
    title.trim().length > 0 &&
    !busy &&
    !listsLoading

  const selectedAccount = taskAccounts.find((a) => a.id === accountId)

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const dueYmd = due.trim()
      const recurErr = validateTaskRecurrenceForm(
        { recurFreq, recurEnd, recurUntilDate, recurCount, recurWeekdays },
        dueYmd
      )
      if (recurErr === 'dueRequired') {
        setError(t('tasks.create.recurrenceDueRequired'))
        setBusy(false)
        return
      }
      if (recurErr === 'untilInvalid') {
        setError(t('tasks.create.recurrenceUntilInvalid'))
        setBusy(false)
        return
      }
      if (recurErr === 'untilBeforeDue') {
        setError(t('tasks.create.recurrenceUntilBeforeDue'))
        setBusy(false)
        return
      }
      if (recurErr === 'countInvalid') {
        setError(t('tasks.create.recurrenceCountInvalid'))
        setBusy(false)
        return
      }
      const recurrence = buildTaskSaveRecurrence({
        recurFreq,
        recurEnd,
        recurUntilDate,
        recurCount,
        recurWeekdays
      })
      const dueIso = dueIsoFromClientInput(dueYmd || null)
      const plannedStartIso = datetimeLocalValueToIso(plannedStart)
      const plannedEndIso = datetimeLocalValueToIso(plannedEnd)
      const row = await window.mailClient.tasks.createTask({
        accountId,
        listId,
        title: title.trim(),
        notes: notes.trim() || null,
        dueIso,
        completed: false,
        ...(recurrence ? { recurrence } : {})
      })
      if (plannedStartIso && plannedEndIso) {
        const taskKey = cloudTaskStableKey(accountId, listId, row.id)
        await applyCloudTaskPersistTarget(
          {
            kind: 'planned',
            taskKey,
            plannedStartIso,
            plannedEndIso
          },
          { accountId, listId, id: row.id },
          timeZone
        )
      }
      persistTasksCalendarCreateAccountId(accountId)
      const listName = lists.find((l) => l.id === listId)?.name ?? ''
      onCreated({ ...row, accountId, listName })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalRoot open={open} zIndex={100} centerClassName="items-center justify-center" onBackdropClick={onClose}>
      <ModalPanel className="flex max-h-[min(90vh,720px)] w-[520px] max-w-[92vw] flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">{t('tasks.create.title')}</h2>
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
            {noTaskAccounts ? (
              <p className="text-sm text-muted-foreground">{t('tasks.create.noAccounts')}</p>
            ) : (
              <>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('tasks.create.account')}</span>
                  <select
                    value={accountId}
                    onChange={(e): void => setAccountId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                  >
                    {taskAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {cloudTaskAccountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('tasks.create.list')}</span>
                  <select
                    value={listId}
                    disabled={listsLoading || lists.length === 0}
                    onChange={(e): void => setListId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm disabled:opacity-50"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('tasks.create.taskTitle')}</span>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    onChange={(e): void => setTitle(e.target.value)}
                    onKeyDown={(e): void => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSubmit()
                      }
                    }}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('tasks.create.plannedStart')}</span>
                    <input
                      type="datetime-local"
                      value={plannedStart}
                      onChange={(e): void => setPlannedStart(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('tasks.create.plannedEnd')}</span>
                    <input
                      type="datetime-local"
                      value={plannedEnd}
                      onChange={(e): void => setPlannedEnd(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('tasks.create.due')}</span>
                  <input
                    type="date"
                    value={due}
                    onChange={(e): void => {
                      const v = e.target.value
                      setDue(v)
                      if (
                        v &&
                        recurWeekdays.length === 0 &&
                        (recurFreq === 'weekly' || recurFreq === 'biweekly')
                      ) {
                        setRecurWeekdays(defaultWeekdayFromDueYmd(v))
                      }
                    }}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>

                <CalendarEventRecurrenceSection
                  i18nPrefix="tasks.create"
                  recurFreq={recurFreq}
                  setRecurFreq={(v): void => {
                    setRecurFreq(v)
                    if (
                      (v === 'weekly' || v === 'biweekly') &&
                      recurWeekdays.length === 0 &&
                      due.trim()
                    ) {
                      setRecurWeekdays(defaultWeekdayFromDueYmd(due.trim()))
                    }
                  }}
                  recurEnd={recurEnd}
                  setRecurEnd={setRecurEnd}
                  recurUntilDate={recurUntilDate}
                  setRecurUntilDate={setRecurUntilDate}
                  recurCount={recurCount}
                  setRecurCount={setRecurCount}
                  recurWeekdays={recurWeekdays}
                  setRecurWeekdays={setRecurWeekdays}
                  eventFieldsLocked={busy}
                />
                {selectedAccount?.provider === 'google' && recurFreq !== 'none' ? (
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    {t('tasks.create.recurrenceGoogleNote')}
                  </p>
                ) : null}

                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('tasks.create.notes')}</span>
                  <textarea
                    value={notes}
                    onChange={(e): void => setNotes(e.target.value)}
                    rows={4}
                    className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
              </>
            )}

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!canSubmit || noTaskAccounts}
              onClick={(): void => void handleSubmit()}
              className={cn(
                'inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground',
                (!canSubmit || noTaskAccounts) && 'pointer-events-none opacity-50'
              )}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t('tasks.create.submit')}
            </button>
          </div>
      </ModalPanel>
    </ModalRoot>
  )
}
