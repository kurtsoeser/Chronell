import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, ListTodo, Loader2, RefreshCw } from 'lucide-react'
import type { TaskListRow } from '@shared/types'
import { cn } from '@/lib/utils'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'
import { useAppModeStore } from '@/stores/app-mode'
import { TasksGroupedList } from '@/app/tasks/TasksGroupedList'
import { TasksListViewMenu } from '@/components/TasksListViewMenu'
import { taskListFilterCounts } from '@/app/tasks/task-list-arrange'
import {
  persistTasksListViewPrefs,
  readTasksListViewPrefs,
  type TasksListViewPrefsV1
} from '@/app/tasks/tasks-list-view-storage'
import type { TasksListItem, TasksViewSelection } from '@/app/tasks/tasks-types'
import { isMailTodoListItem, tasksListItemKey, type CloudTaskListItem } from '@/app/tasks/tasks-types'
import { loadOpenMailTodosForTasksList, mergeCloudAndMailTaskItems } from '@/app/tasks/tasks-mail-todos'
import { useTasksSettingsPrefs } from '@/lib/use-tasks-settings-prefs'

export function MailTasksSidebar(): JSX.Element {
  const { t } = useTranslation()
  const tasksSettings = useTasksSettingsPrefs()
  const accounts = useAccountsStore((s) => s.accounts)
  const taskAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const setAppMode = useAppModeStore((s) => s.setMode)

  const completeTodoForMessage = useMailStore((s) => s.completeTodoForMessage)

  const [listsByAccount, setListsByAccount] = useState<Record<string, TaskListRow[] | undefined>>({})
  const [listsLoadingByAccount, setListsLoadingByAccount] = useState<Record<string, boolean>>({})
  const [listsErrorByAccount, setListsErrorByAccount] = useState<Record<string, string | null>>({})

  const [tasksError, setTasksError] = useState<string | null>(null)
  const [unifiedLoading, setUnifiedLoading] = useState(false)

  const [unifiedTasks, setUnifiedTasks] = useState<CloudTaskListItem[]>([])
  const unifiedTasksRef = useRef<CloudTaskListItem[]>([])
  unifiedTasksRef.current = unifiedTasks

  const [mailTodoItems, setMailTodoItems] = useState<import('@/app/tasks/tasks-types').MailTodoListItem[]>(
    []
  )

  const selection: TasksViewSelection = useMemo(() => ({ kind: 'unified' }), [])
  const isUnified = true

  const loadListsForAccount = useCallback(
    async (targetAccountId: string, opts?: { force?: boolean }): Promise<TaskListRow[]> => {
      if (!opts?.force && listsByAccount[targetAccountId] !== undefined) {
        return listsByAccount[targetAccountId] ?? []
      }
      setListsLoadingByAccount((prev) => ({ ...prev, [targetAccountId]: true }))
      setListsErrorByAccount((prev) => ({ ...prev, [targetAccountId]: null }))
      try {
        const rows = await window.mailClient.tasks.listLists({ accountId: targetAccountId })
        setListsByAccount((prev) => ({ ...prev, [targetAccountId]: rows }))
        return rows
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setListsErrorByAccount((prev) => ({ ...prev, [targetAccountId]: msg }))
        setListsByAccount((prev) => ({ ...prev, [targetAccountId]: [] }))
        return []
      } finally {
        setListsLoadingByAccount((prev) => ({ ...prev, [targetAccountId]: false }))
      }
    },
    [listsByAccount]
  )

  const loadUnifiedTasks = useCallback(
    async (opts?: { silent?: boolean; forceRefresh?: boolean }): Promise<void> => {
      const silent = opts?.silent ?? unifiedTasksRef.current.length > 0
      if (!silent) setUnifiedLoading(true)
      setTasksError(null)
      try {
        const merged: CloudTaskListItem[] = []
        for (const acc of taskAccounts) {
          const lists = await loadListsForAccount(acc.id)
          for (const list of lists) {
            try {
              const rows = await window.mailClient.tasks.listTasks({
                accountId: acc.id,
                listId: list.id,
                showCompleted: true,
                showHidden: false,
                forceRefresh: opts?.forceRefresh === true
              })
              for (const row of rows) {
                merged.push({
                  ...row,
                  accountId: acc.id,
                  listName: list.name,
                  source: 'cloud'
                })
              }
            } catch (e) {
              console.warn('[MailTasksSidebar] unified listTasks failed', acc.id, list.id, e)
            }
          }
        }
        setUnifiedTasks(merged)
      } catch (e) {
        setTasksError(e instanceof Error ? e.message : String(e))
        if (!silent) setUnifiedTasks([])
      } finally {
        if (!silent) setUnifiedLoading(false)
      }
    },
    [taskAccounts, loadListsForAccount]
  )

  const loadMailTodos = useCallback(async (): Promise<void> => {
    if (!tasksSettings.includeMailTodosInList || !isUnified) {
      setMailTodoItems([])
      return
    }
    try {
      const rows = await loadOpenMailTodosForTasksList(t('tasks.listArrange.mailSource'))
      setMailTodoItems(rows)
    } catch {
      setMailTodoItems([])
    }
  }, [isUnified, tasksSettings.includeMailTodosInList, t])

  useEffect(() => {
    void loadUnifiedTasks()
  }, [loadUnifiedTasks])

  useEffect(() => {
    void loadMailTodos()
  }, [loadMailTodos])

  useEffect(() => {
    const off = window.mailClient.events.onTasksChanged(() => {
      void loadUnifiedTasks({ silent: true })
    })
    return off
  }, [loadUnifiedTasks])

  useEffect(() => {
    const off = window.mailClient.events.onMailChanged(() => {
      if (tasksSettings.includeMailTodosInList) void loadMailTodos()
    })
    return off
  }, [loadMailTodos, tasksSettings.includeMailTodosInList])

  const [listViewPrefs, setListViewPrefs] = useState<TasksListViewPrefsV1>(() => readTasksListViewPrefs())
  useEffect(() => {
    persistTasksListViewPrefs(listViewPrefs)
  }, [listViewPrefs])

  const displayItems: TasksListItem[] = useMemo(() => {
    const cloud = unifiedTasks
    if (tasksSettings.includeMailTodosInList) return mergeCloudAndMailTaskItems(cloud, mailTodoItems)
    return cloud
  }, [mailTodoItems, tasksSettings.includeMailTodosInList, unifiedTasks])

  const filterCounts = useMemo(
    () =>
      taskListFilterCounts(
        displayItems,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        tasksSettings.overdueMode
      ),
    [displayItems, tasksSettings.overdueMode]
  )

  const [selected, setSelected] = useState<TasksListItem | null>(null)
  const selectedKey = selected ? tasksListItemKey(selected) : null
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set())

  const patchTask = useCallback(
    async (item: CloudTaskListItem, patch: { completed?: boolean }): Promise<void> => {
      const next = await window.mailClient.tasks.patchTask({
        accountId: item.accountId,
        listId: item.listId,
        taskId: item.id,
        ...patch
      })
      const merged: CloudTaskListItem = {
        ...next,
        accountId: item.accountId,
        listName: item.listName,
        source: 'cloud'
      }
      setUnifiedTasks((prev) => prev.map((x) => (tasksListItemKey(x) === tasksListItemKey(merged) ? merged : x)))
      setSelected((s) => (s && tasksListItemKey(s) === tasksListItemKey(merged) ? merged : s))
    },
    []
  )

  const toggleCompleted = useCallback(
    async (task: TasksListItem): Promise<void> => {
      if (isMailTodoListItem(task)) {
        try {
          if (!task.completed) {
            await completeTodoForMessage(task.messageId)
          } else {
            await useMailStore.getState().setTodoForMessage(task.messageId, 'today')
          }
        } finally {
          void loadMailTodos()
        }
        return
      }
      try {
        await patchTask(task, { completed: !task.completed })
      } catch {
        void loadUnifiedTasks()
      }
    },
    [completeTodoForMessage, loadMailTodos, loadUnifiedTasks, patchTask]
  )

  const onTaskClick = useCallback((_item: TasksListItem, _event: React.MouseEvent): void => {
    // In der Sidebar kein Detailpanel: Auswahl reicht.
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-foreground">
              {t('mail.rightSidebar.tasksTitle')}
            </div>
            <div className="mt-1">
              <TasksListViewMenu
                arrange={listViewPrefs.arrange}
                chrono={listViewPrefs.chrono}
                filter={listViewPrefs.filter}
                filterCounts={filterCounts}
                showAccountArrange
                onArrangeChange={(v): void => setListViewPrefs((p) => ({ ...p, arrange: v }))}
                onChronoChange={(v): void => setListViewPrefs((p) => ({ ...p, chrono: v }))}
                onFilterChange={(v): void => setListViewPrefs((p) => ({ ...p, filter: v }))}
              />
            </div>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            title={t('tasks.shell.refreshUnified')}
            aria-label={t('tasks.shell.refreshUnified')}
            onClick={(): void => void loadUnifiedTasks({ forceRefresh: true })}
          >
            <RefreshCw className={cn('h-4 w-4', unifiedLoading && 'animate-spin')} />
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-2xs font-medium',
              'text-foreground hover:bg-secondary/60'
            )}
            onClick={(): void => setAppMode('tasks')}
            title={t('mail.rightSidebar.openTasks')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('mail.rightSidebar.openTasks')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tasksError ? (
          <p className="p-3 text-xs text-destructive">{tasksError}</p>
        ) : unifiedLoading && displayItems.length === 0 ? (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : taskAccounts.length === 0 ? (
          <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
            <ListTodo className="h-5 w-5 opacity-70" />
            {t('tasks.shell.noAccounts')}
          </div>
        ) : (
          <TasksGroupedList
            items={displayItems}
            accounts={taskAccounts}
            arrange={listViewPrefs.arrange}
            chrono={listViewPrefs.chrono}
            filter={listViewPrefs.filter}
            showAccountHint
            selectedKey={selectedKey}
            checkedKeys={checkedKeys}
            onSelect={setSelected}
            onTaskClick={onTaskClick}
            onToggleCompleted={(item): void => void toggleCompleted(item)}
            enableDrag={tasksSettings.listDragEnabled}
            inlineCreate={{
              selection,
              taskAccounts,
              loadListsForAccount,
              onCreated: async (): Promise<void> => {
                void loadUnifiedTasks({ silent: true, forceRefresh: true })
              },
              showAccountPicker: true
            }}
          />
        )}
        {Object.values(listsErrorByAccount).some((x) => x) ? (
          <p className="px-3 pb-3 text-2xs text-muted-foreground">
            {t('tasks.shell.listsLoading')}
          </p>
        ) : null}
      </div>
    </div>
  )
}

