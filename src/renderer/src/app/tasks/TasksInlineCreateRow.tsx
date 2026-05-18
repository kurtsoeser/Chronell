import { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount, TaskListRow } from '@shared/types'
import { dueIsoFromClientInput } from '@shared/calendar-datetime'
import { persistTasksCalendarCreateAccountId } from '@/app/tasks/tasks-calendar-create-storage'
import {
  resolvePreferredAccountId,
  resolvePreferredListId
} from '@/app/tasks/tasks-create-defaults'
import type { TaskItemWithContext, TasksViewSelection } from '@/app/tasks/tasks-types'
import { cloudTaskAccountOptionLabel } from '@/lib/cloud-task-accounts'
import { cn } from '@/lib/utils'

export interface TasksInlineCreateRowProps {
  selection: TasksViewSelection | null
  taskAccounts: ConnectedAccount[]
  loadListsForAccount: (accountId: string) => Promise<TaskListRow[]>
  onCreated: (task: TaskItemWithContext) => void
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
        setListId(resolvePreferredListId(selection, accountId, rows))
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
      onCreated({ ...row, accountId, listName })
      setTitle('')
      setDue('')
      setNotes('')
      window.setTimeout(() => titleRef.current?.focus(), 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [accountId, canSubmit, due, listId, lists, notes, onCreated, title])

  if (taskAccounts.length === 0) return null

  const fieldClass =
    'min-w-0 rounded border border-border/80 bg-background px-1.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'

  return (
    <li className="relative border-b border-dashed border-border/80 bg-muted/15">
      <div className="flex items-start gap-1.5 px-2 py-1.5">
        <span className="flex w-4 shrink-0 justify-center self-start py-2" aria-hidden>
          <Circle className="h-4 w-4 text-muted-foreground/25" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {showAccountPicker ? (
              <>
                <select
                  value={accountId}
                  onChange={(e): void => setAccountId(e.target.value)}
                  aria-label={t('tasks.create.account')}
                  className={cn(fieldClass, 'max-w-[9rem] shrink-0')}
                >
                  {taskAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {cloudTaskAccountOptionLabel(a)}
                    </option>
                  ))}
                </select>
                <select
                  value={listId}
                  disabled={listsLoading || lists.length === 0}
                  onChange={(e): void => setListId(e.target.value)}
                  aria-label={t('tasks.create.list')}
                  className={cn(fieldClass, 'max-w-[8rem] shrink-0')}
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <input
              ref={titleRef}
              type="text"
              value={title}
              disabled={busy}
              placeholder={t('tasks.shell.inlineCreateTitle')}
              onChange={(e): void => setTitle(e.target.value)}
              onKeyDown={(e): void => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void submit()
                }
              }}
              className={cn(fieldClass, 'min-w-[8rem] flex-1')}
            />
            <input
              type="date"
              value={due}
              disabled={busy}
              onChange={(e): void => setDue(e.target.value)}
              aria-label={t('tasks.create.due')}
              className={cn(fieldClass, 'w-[8.5rem] shrink-0')}
            />
            <input
              type="text"
              value={notes}
              disabled={busy}
              placeholder={t('tasks.shell.inlineCreateNotes')}
              onChange={(e): void => setNotes(e.target.value)}
              onKeyDown={(e): void => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void submit()
                }
              }}
              className={cn(fieldClass, 'min-w-[6rem] flex-[2]')}
            />
            {busy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : null}
          </div>
          {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
        </div>
        <span className="w-4 shrink-0" aria-hidden />
      </div>
    </li>
  )
}
