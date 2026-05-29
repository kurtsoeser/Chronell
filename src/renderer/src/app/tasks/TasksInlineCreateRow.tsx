import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Circle, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount, TaskListRow } from '@shared/types'
import { dueIsoFromClientInput } from '@shared/calendar-datetime'
import { persistTasksCalendarCreateAccountId } from '@/app/tasks/tasks-calendar-create-storage'
import {
  pickCreateTaskListId,
  resolvePreferredAccountId,
  resolvePreferredListId
} from '@/app/tasks/tasks-create-defaults'
import type { CloudTaskListItem, TasksViewSelection } from '@/app/tasks/tasks-types'
import { readTasksSettingsPrefs } from '@/lib/tasks-settings-prefs'
import { defaultDueInputForCreate } from '@/lib/tasks-default-due-on-create'
import { useTasksSettingsPrefs } from '@/lib/use-tasks-settings-prefs'
import { cloudTaskAccountOptionLabel } from '@/lib/cloud-task-accounts'
import { fieldControlClass, listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { ChronellDateField } from '@/components/ChronellDateField'

export interface TasksInlineCreateRowProps {
  selection: TasksViewSelection | null
  taskAccounts: ConnectedAccount[]
  loadListsForAccount: (accountId: string) => Promise<TaskListRow[]>
  onCreated: (task: CloudTaskListItem) => void
  /** „Alle Aufgaben“ — Konto und Liste in der Zeile wählen. */
  showAccountPicker: boolean
}

export function TasksInlineCreateRow({
  selection,
  taskAccounts,
  loadListsForAccount,
  onCreated,
  showAccountPicker
}: TasksInlineCreateRowProps): JSX.Element | null {
  const { t } = useTranslation()
  const settings = useTasksSettingsPrefs()
  const titleRef = useRef<HTMLInputElement>(null)

  const [accountId, setAccountId] = useState('')
  const [listId, setListId] = useState('')
  const [lists, setLists] = useState<TaskListRow[]>([])
  const [listsLoading, setListsLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fixedList =
    selection?.kind === 'list'
      ? { accountId: selection.accountId, listId: selection.listId }
      : null

  useEffect(() => {
    if (taskAccounts.length === 0) return
    if (fixedList) {
      setAccountId(fixedList.accountId)
      setListId(fixedList.listId)
      return
    }
    setAccountId(resolvePreferredAccountId(taskAccounts, selection))
  }, [fixedList, selection, taskAccounts])

  useEffect(() => {
    if (!selection) return
    window.setTimeout(() => titleRef.current?.focus(), 0)
  }, [
    selection,
    selection?.kind === 'list' ? selection.accountId : '',
    selection?.kind === 'list' ? selection.listId : ''
  ])

  useEffect(() => {
    if (!accountId || fixedList) return
    let cancelled = false
    setListsLoading(true)
    void loadListsForAccount(accountId)
      .then((rows) => {
        if (cancelled) return
        setLists(rows)
        setListId(
          selection?.kind === 'list' && selection.accountId === accountId
            ? resolvePreferredListId(selection, accountId, rows)
            : (pickCreateTaskListId(rows) ?? '')
        )
      })
      .catch(() => {
        if (cancelled) return
        setLists([])
        setListId('')
      })
      .finally(() => {
        if (!cancelled) setListsLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [accountId, fixedList, loadListsForAccount, selection])

  const canSubmit =
    taskAccounts.length > 0 &&
    Boolean(accountId) &&
    Boolean(listId) &&
    title.trim().length > 0 &&
    !busy &&
    !listsLoading

  const submit = useCallback(async (): Promise<void> => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const dueIso = dueIsoFromClientInput(due.trim() || null)
      const row = await window.mailClient.tasks.createTask({
        accountId,
        listId,
        title: title.trim(),
        notes: notes.trim() || null,
        dueIso,
        completed: false
      })
      persistTasksCalendarCreateAccountId(accountId)
      const listName = lists.find((l) => l.id === listId)?.name ?? ''
      onCreated({ ...row, accountId, listName, source: 'cloud' })
      setTitle('')
      setDue(defaultDueInputForCreate(readTasksSettingsPrefs().defaultDueOnCreate))
      setNotes('')
      window.setTimeout(() => titleRef.current?.focus(), 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [accountId, canSubmit, due, listId, lists, notes, onCreated, title])

  const submitFromEnter = useCallback(
    (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.shiftKey) return
      e.preventDefault()
      void submit()
    },
    [submit]
  )

  useEffect(() => {
    setDue(defaultDueInputForCreate(settings.defaultDueOnCreate))
  }, [settings.defaultDueOnCreate])

  if (taskAccounts.length === 0) return null

  return (
    <li className={cn('relative border-b border-dashed bg-muted/15', listSubtleBorderClass)}>
      <div className="flex items-start gap-1.5 px-2 py-1.5">
        <span className="flex w-4 shrink-0 justify-center self-start py-2" aria-hidden>
          <Circle className="h-4 w-4 text-muted-foreground/25" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {showAccountPicker ? (
              <select
                value={accountId}
                onChange={(e): void => setAccountId(e.target.value)}
                onKeyDown={submitFromEnter}
                aria-label={t('tasks.create.account')}
                className={cn(fieldControlClass, 'max-w-[9rem] shrink-0 px-1.5 py-1 text-xs')}
              >
                {taskAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {cloudTaskAccountOptionLabel(a)}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              ref={titleRef}
              type="text"
              value={title}
              disabled={busy}
              placeholder={t('tasks.shell.inlineCreateTitle')}
              onChange={(e): void => setTitle(e.target.value)}
              onKeyDown={submitFromEnter}
              className={cn(fieldControlClass, 'min-w-[8rem] flex-1 px-1.5 py-1 text-xs')}
            />
            <ChronellDateField
              value={due}
              disabled={busy}
              onChange={setDue}
              onKeyDown={submitFromEnter}
              aria-label={t('tasks.create.due')}
              className={cn(fieldControlClass, 'w-[8.5rem] shrink-0 px-1.5 py-1 text-xs')}
            />
            {settings.inlineCreateShowNotes ? (
              <input
                type="text"
                value={notes}
                disabled={busy}
                placeholder={t('tasks.shell.inlineCreateNotes')}
                onChange={(e): void => setNotes(e.target.value)}
                onKeyDown={submitFromEnter}
                className={cn(fieldControlClass, 'min-w-[6rem] flex-[2] px-1.5 py-1 text-xs')}
              />
            ) : null}
            <button
              type="button"
              disabled={!canSubmit}
              title={t('tasks.shell.inlineCreateSubmit')}
              aria-label={t('tasks.shell.inlineCreateSubmit')}
              onClick={(): void => void submit()}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border',
                'bg-primary/10 text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </div>
          {error ? <p className="text-2xs text-destructive">{error}</p> : null}
        </div>
        <span className="w-4 shrink-0" aria-hidden />
      </div>
    </li>
  )
}
