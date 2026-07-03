import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount, TaskListRow } from '@shared/types'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import { datetimeLocalValueToIso } from '@/app/work-items/work-item-datetime'
import { persistTasksCalendarCreateAccountId } from '@/app/tasks/tasks-calendar-create-storage'
import { pickDefaultListId, resolvePreferredAccountId } from '@/app/tasks/tasks-create-defaults'
import { cloudTaskAccountOptionLabel, accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import { createAndLinkNoteCloudTask } from '@/lib/note-cloud-task-insert'
import { formatNoteCloudTaskDueLabel } from '@/lib/note-cloud-task-format'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

export interface NoteCreateCloudTaskDialogProps {
  open: boolean
  noteId: number | null
  initialTitle?: string
  taskAccounts: ConnectedAccount[]
  onClose: () => void
  onCreated: (html: string) => void
  onLinkAdded?: () => void
  onError?: (message: string) => void
}

export function NoteCreateCloudTaskDialog({
  open,
  noteId,
  initialTitle = '',
  taskAccounts,
  onClose,
  onCreated,
  onLinkAdded,
  onError
}: NoteCreateCloudTaskDialogProps): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const titleInputRef = useRef<HTMLInputElement>(null)
  const supportedAccounts = useMemo(
    () => taskAccounts.filter(accountSupportsCloudTasks),
    [taskAccounts]
  )

  const [accountId, setAccountId] = useState('')
  const [listId, setListId] = useState('')
  const [lists, setLists] = useState<TaskListRow[]>([])
  const [listsLoading, setListsLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [dueLocal, setDueLocal] = useState('')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAccountId(resolvePreferredAccountId(supportedAccounts, null))
    setTitle(initialTitle.trim())
    setDueLocal('')
    setPlannedStart('')
    setPlannedEnd('')
    setError(null)
    window.setTimeout(() => titleInputRef.current?.focus(), 0)
  }, [initialTitle, open, supportedAccounts])

  useEffect(() => {
    if (!open || !accountId) {
      setLists([])
      setListId('')
      return
    }
    let cancelled = false
    setListsLoading(true)
    void window.mailClient.tasks
      .listLists({ accountId })
      .then((rows) => {
        if (cancelled) return
        setLists(rows)
        setListId(pickDefaultListId(rows) ?? '')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLists([])
        setListId('')
      })
      .finally(() => {
        if (!cancelled) setListsLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [accountId, open])

  async function handleSubmit(): Promise<void> {
    if (!noteId || !accountId || !listId || !title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const dueIso = datetimeLocalValueToIso(dueLocal)
      const plannedStartIso = datetimeLocalValueToIso(plannedStart)
      const plannedEndIso = datetimeLocalValueToIso(plannedEnd)
      const { html, task } = await createAndLinkNoteCloudTask({
        noteId,
        title: title.trim(),
        dueIso,
        accountId,
        listId,
        dueLabel: formatNoteCloudTaskDueLabel(dueIso, i18n.language)
      })
      if (plannedStartIso && plannedEndIso) {
        const taskKey = cloudTaskStableKey(accountId, listId, task.id)
        await applyCloudTaskPersistTarget(
          {
            kind: 'planned',
            taskKey,
            plannedStartIso,
            plannedEndIso
          },
          { accountId, listId, id: task.id },
          timeZone
        )
      }
      persistTasksCalendarCreateAccountId(accountId)
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

  const noAccounts = supportedAccounts.length === 0

  return (
    <ModalRoot open={open} zIndex={100} centerClassName="items-center justify-center" onBackdropClick={onClose}>
      <ModalPanel className="flex max-h-[min(90vh,640px)] w-[480px] max-w-[92vw] flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">{t('notes.cloudTask.title')}</h2>
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
            <p className="text-sm text-muted-foreground">{t('notes.cloudTask.noAccounts')}</p>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('tasks.create.account')}</span>
                <select
                  value={accountId}
                  onChange={(e): void => setAccountId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                >
                  {supportedAccounts.map((a) => (
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

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('notes.cloudTask.due')}</span>
                <input
                  type="datetime-local"
                  value={dueLocal}
                  onChange={(e): void => setDueLocal(e.target.value)}
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
            disabled={busy || noAccounts || !title.trim() || !noteId || !listId}
            onClick={(): void => void handleSubmit()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {t('notes.cloudTask.create')}
          </button>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
