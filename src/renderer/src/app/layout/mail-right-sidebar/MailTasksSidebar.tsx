import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, ListTodo, Loader2, RefreshCw } from 'lucide-react'
import type { TaskListRow } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { cn } from '@/lib/utils'
import { useExitingIds } from '@/lib/use-exiting-ids'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'
import { useAppModeStore } from '@/stores/app-mode'
import { useComposeStore } from '@/stores/compose'
import { useSnoozeUiStore } from '@/stores/snooze-ui'
import { useTasksPendingFocusStore } from '@/stores/tasks-pending-focus'
import { TasksGroupedList } from '@/app/tasks/TasksGroupedList'
import { TasksListViewMenu } from '@/components/TasksListViewMenu'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { taskListFilterCounts } from '@/app/tasks/task-list-arrange'
import { confirmDeleteCloudTasks } from '@/app/tasks/confirm-delete-cloud-task'
import { buildTasksListContextMenuItems } from '@/app/tasks/tasks-list-context-menu'
import type { MailContextHandlers } from '@/lib/mail-context-menu'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import { openWorkItemInCalendar } from '@/app/work-items/work-item-calendar-nav'
import type { WorkItemContextHandlers } from '@/app/work-items/work-item-context-menu'
import {
  persistTasksListViewPrefs,
  readTasksListViewPrefs,
  type TasksListViewPrefsV1
} from '@/app/tasks/tasks-list-view-storage'
import type { TasksListItem, TasksViewSelection } from '@/app/tasks/tasks-types'
import {
  isCloudTaskListItem,
  isMailTodoListItem,
  tasksListItemKey,
  type CloudTaskListItem
} from '@/app/tasks/tasks-types'
import { loadOpenMailTodosForTasksList, mergeCloudAndMailTaskItems } from '@/app/tasks/tasks-mail-todos'
import { runOptimisticTaskToggle, withTaskCompletedFlag } from '@/app/tasks/tasks-toggle-completed'
import {
  upsertCloudTaskInList,
  type TaskCreateUpsertMeta
} from '@/app/tasks/tasks-optimistic-create'
import type { TaskItemRow } from '@shared/types'
import { loadUnifiedCloudTasks } from '@/app/tasks/tasks-calendar-load'
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

  const { isExiting, markExiting } = useExitingIds<string>()
  const completeTodoForMessage = useMailStore((s) => s.completeTodoForMessage)
  const selectMessage = useMailStore((s) => s.selectMessage)
  const setMessageRead = useMailStore((s) => s.setMessageRead)
  const toggleMessageFlag = useMailStore((s) => s.toggleMessageFlag)
  const archiveMessage = useMailStore((s) => s.archiveMessage)
  const deleteMessage = useMailStore((s) => s.deleteMessage)
  const setTodoForMessage = useMailStore((s) => s.setTodoForMessage)
  const setWaitingForMessage = useMailStore((s) => s.setWaitingForMessage)
  const clearWaitingForMessage = useMailStore((s) => s.clearWaitingForMessage)
  const refreshNow = useMailStore((s) => s.refreshNow)
  const openReply = useComposeStore((s) => s.openReply)
  const openForward = useComposeStore((s) => s.openForward)
  const openSnoozePicker = useSnoozeUiStore((s) => s.open)

  const [taskListContextMenu, setTaskListContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)

  const [listsByAccount, setListsByAccount] = useState<Record<string, TaskListRow[] | undefined>>({})
  const [listsLoadingByAccount, setListsLoadingByAccount] = useState<Record<string, boolean>>({})
  const [listsErrorByAccount, setListsErrorByAccount] = useState<Record<string, string | null>>({})

  const [tasksError, setTasksError] = useState<string | null>(null)
  const [unifiedLoading, setUnifiedLoading] = useState(false)

  const [unifiedTasks, setUnifiedTasks] = useState<CloudTaskListItem[]>([])
  const unifiedTasksRef = useRef<CloudTaskListItem[]>([])
  unifiedTasksRef.current = unifiedTasks
  const skipNextTasksChangedReloadRef = useRef(false)

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
      if (taskAccounts.length === 0) {
        setUnifiedTasks([])
        return
      }
      const silent = opts?.silent ?? unifiedTasksRef.current.length > 0
      const forceRefresh = opts?.forceRefresh === true
      if (!silent) setUnifiedLoading(true)
      setTasksError(null)
      try {
        if (!forceRefresh) {
          const cached = await loadUnifiedCloudTasks(taskAccounts, { cacheOnly: true })
          if (cached.length > 0) {
            setUnifiedTasks(cached)
            if (!silent) setUnifiedLoading(false)
            void loadUnifiedCloudTasks(taskAccounts)
              .then((fresh) => setUnifiedTasks(fresh))
              .catch((e) => {
                console.warn('[MailTasksSidebar] background unified refresh failed', e)
              })
            return
          }
        }
        const merged = await loadUnifiedCloudTasks(taskAccounts, { forceRefresh })
        setUnifiedTasks(merged)
        for (const acc of taskAccounts) {
          void loadListsForAccount(acc.id, { force: forceRefresh })
        }
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
      if (skipNextTasksChangedReloadRef.current) {
        skipNextTasksChangedReloadRef.current = false
        return
      }
      void loadUnifiedCloudTasks(taskAccounts, { cacheOnly: true })
        .then(setUnifiedTasks)
        .catch((e) => console.warn('[MailTasksSidebar] tasks-changed cache reload failed', e))
    })
    return off
  }, [taskAccounts])

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

  const handleInlineTaskCreated = useCallback(
    (task: CloudTaskListItem, meta?: TaskCreateUpsertMeta): void => {
      if (meta?.removePendingId) {
        setUnifiedTasks((prev) => upsertCloudTaskInList(prev, task, meta))
        setSelected((s) =>
          s && isCloudTaskListItem(s) && s.id === meta.removePendingId ? null : s
        )
        return
      }
      setUnifiedTasks((prev) => upsertCloudTaskInList(prev, task, meta))
      setSelected(task)
      if (!meta?.removePendingId) {
        skipNextTasksChangedReloadRef.current = true
      }
    },
    []
  )

  const applyCloudTaskRow = useCallback((next: TaskItemRow, ctx: CloudTaskListItem): void => {
    const merged: CloudTaskListItem = {
      ...next,
      accountId: ctx.accountId,
      listName: ctx.listName,
      source: 'cloud'
    }
    setUnifiedTasks((prev) =>
      prev.map((x) => (tasksListItemKey(x) === tasksListItemKey(merged) ? merged : x))
    )
    setSelected((s) => (s && tasksListItemKey(s) === tasksListItemKey(merged) ? merged : s))
  }, [])

  const toggleCompleted = useCallback(
    (task: TasksListItem): void => {
      runOptimisticTaskToggle({
        task,
        filter: listViewPrefs.filter,
        markExiting,
        onCloudOptimistic: (item, completed): void => {
          const merged = withTaskCompletedFlag(item, completed)
          setUnifiedTasks((prev) =>
            prev.map((x) => (tasksListItemKey(x) === tasksListItemKey(merged) ? merged : x))
          )
          setSelected((s) =>
            s && tasksListItemKey(s) === tasksListItemKey(merged) ? merged : s
          )
        },
        onMailOptimistic: (item, completed): void => {
          const merged = withTaskCompletedFlag(item, completed)
          setMailTodoItems((prev) =>
            prev.map((x) => (x.messageId === item.messageId ? merged : x))
          )
          setSelected((s) =>
            s && tasksListItemKey(s) === tasksListItemKey(merged) ? merged : s
          )
        },
        onMailRemove: (messageId): void => {
          setMailTodoItems((prev) => prev.filter((x) => x.messageId !== messageId))
          setSelected((s) =>
            s && isMailTodoListItem(s) && s.messageId === messageId ? null : s
          )
        },
        onCloudRevert: (item, previous): void => {
          const merged = withTaskCompletedFlag(item, previous)
          setUnifiedTasks((prev) =>
            prev.map((x) => (tasksListItemKey(x) === tasksListItemKey(merged) ? merged : x))
          )
        },
        onMailRevert: (item): void => {
          setMailTodoItems((prev) => {
            if (prev.some((x) => x.messageId === item.messageId)) {
              return prev.map((x) => (x.messageId === item.messageId ? item : x))
            }
            return [...prev, item]
          })
        },
        patchCloudRemote: async (item, completed): Promise<TaskItemRow> => {
          const next = await window.mailClient.tasks.patchTask({
            accountId: item.accountId,
            listId: item.listId,
            taskId: item.id,
            completed
          })
          applyCloudTaskRow(next, item)
          return next
        },
        completeMailRemote: (messageId): Promise<void> =>
          window.mailClient.mail.completeTodoForMessage(messageId),
        reopenMailRemote: (messageId): Promise<void> =>
          window.mailClient.mail.setTodoForMessage({ messageId, dueKind: 'today' }),
        onCloudSyncError: (): void => {
          void loadUnifiedTasks()
        },
        onMailSyncError: (): void => {
          void loadMailTodos()
        }
      })
    },
    [listViewPrefs.filter, markExiting, applyCloudTaskRow, loadMailTodos, loadUnifiedTasks]
  )

  const onTaskClick = useCallback((item: TasksListItem, _event: MouseEvent): void => {
    setSelected(item)
  }, [])

  const displayItemsRef = useRef(displayItems)
  displayItemsRef.current = displayItems

  const toggleWorkItemCompleted = useCallback(
    async (item: WorkItem): Promise<void> => {
      if (item.kind === 'calendar_event') return
      if (item.kind === 'mail_todo') {
        const hit = displayItemsRef.current.find(
          (x) => isMailTodoListItem(x) && x.messageId === item.messageId
        )
        if (hit) await toggleCompleted(hit)
        return
      }
      const hit = displayItemsRef.current.find(
        (x) => isCloudTaskListItem(x) && tasksListItemKey(x) === item.stableKey
      )
      if (hit) await toggleCompleted(hit)
    },
    [toggleCompleted]
  )

  const deleteCloudTask = useCallback(
    async (item: CloudTaskListItem): Promise<void> => {
      if (!(await confirmDeleteCloudTasks(t, 1))) return
      try {
        await window.mailClient.tasks.deleteTask({
          accountId: item.accountId,
          listId: item.listId,
          taskId: item.id
        })
        const key = tasksListItemKey(item)
        setUnifiedTasks((prev) => prev.filter((x) => tasksListItemKey(x) !== key))
        setSelected((s) => (s && tasksListItemKey(s) === key ? null : s))
      } catch (e) {
        setTasksError(e instanceof Error ? e.message : String(e))
      }
    },
    [t]
  )

  const handleTaskEdit = useCallback(
    (task: TasksListItem): void => {
      setSelected(task)
      if (isCloudTaskListItem(task)) {
        useTasksPendingFocusStore.getState().queueTask({
          accountId: task.accountId,
          listId: task.listId,
          taskId: task.id
        })
        setAppMode('tasks')
        return
      }
      if (isMailTodoListItem(task)) {
        void selectMessage(task.messageId)
        setAppMode('mail')
      }
    },
    [selectMessage, setAppMode]
  )

  const mailContextHandlers = useMemo<MailContextHandlers>(
    () => ({
      openReply,
      openForward,
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage,
      setTodoForMessage,
      completeTodoForMessage: async (messageId: number): Promise<void> => {
        await completeTodoForMessage(messageId)
        void loadMailTodos()
      },
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow: async (): Promise<void> => {
        await refreshNow()
        void loadMailTodos()
      }
    }),
    [
      openReply,
      openForward,
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage,
      setTodoForMessage,
      completeTodoForMessage,
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow,
      loadMailTodos
    ]
  )

  const workContextHandlers = useMemo<WorkItemContextHandlers>(
    () => ({
      t,
      mailHandlers: mailContextHandlers,
      canCreateCloudTask: (accountId): boolean =>
        taskAccounts.some((a) => a.id === accountId && accountSupportsCloudTasks(a)),
      onToggleCompleted: toggleWorkItemCompleted,
      onShowInCalendar: (item): void => openWorkItemInCalendar(item, setAppMode),
      onOpenInMail: (item): void => {
        void selectMessage(item.messageId)
        setAppMode('mail')
      },
      onOpenInTasks: (item): void => {
        useTasksPendingFocusStore.getState().queueTask({
          accountId: item.accountId,
          listId: item.listId,
          taskId: item.taskId
        })
        setAppMode('tasks')
      },
      onDeleteCloudTask: async (item): Promise<void> => {
        const key = cloudTaskStableKey(item.accountId, item.listId, item.taskId)
        const hit = displayItemsRef.current.find(
          (x) => isCloudTaskListItem(x) && tasksListItemKey(x) === key
        )
        if (hit && isCloudTaskListItem(hit)) await deleteCloudTask(hit)
      },
      refreshMailList: (): void => {
        void loadMailTodos()
      }
    }),
    [
      t,
      mailContextHandlers,
      taskAccounts,
      toggleWorkItemCompleted,
      setAppMode,
      selectMessage,
      deleteCloudTask,
      loadMailTodos
    ]
  )

  const workContextHandlersRef = useRef(workContextHandlers)
  workContextHandlersRef.current = workContextHandlers

  const openTaskContextMenu = useCallback(
    (task: TasksListItem, event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      void (async (): Promise<void> => {
        const items = await buildTasksListContextMenuItems(
          task,
          { x: event.clientX, y: event.clientY },
          {
            t,
            workItemHandlers: workContextHandlersRef.current,
            onEdit: handleTaskEdit
          }
        )
        setTaskListContextMenu({ x: event.clientX, y: event.clientY, items })
      })()
    },
    [t, handleTaskEdit]
  )

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
            onToggleCompleted={toggleCompleted}
            onTaskContextMenu={openTaskContextMenu}
            enableDrag={tasksSettings.listDragEnabled}
            isItemExiting={isExiting}
            inlineCreate={{
              selection,
              taskAccounts,
              loadListsForAccount,
              onCreated: handleInlineTaskCreated,
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

      {taskListContextMenu ? (
        <ContextMenu
          x={taskListContextMenu.x}
          y={taskListContextMenu.y}
          items={taskListContextMenu.items}
          onClose={(): void => setTaskListContextMenu(null)}
        />
      ) : null}
    </div>
  )
}

