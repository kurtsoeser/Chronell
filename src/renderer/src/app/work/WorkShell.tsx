import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Columns3, LayoutGrid, List, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WorkItem } from '@shared/work-item'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'
import { useComposeStore } from '@/stores/compose'
import { useAppModeStore } from '@/stores/app-mode'
import { useSnoozeUiStore } from '@/stores/snooze-ui'
import { cn } from '@/lib/utils'
import { TasksListViewMenu } from '@/components/TasksListViewMenu'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import {
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderOutlineSmClass,
  moduleColumnHeaderShellBarClass
} from '@/components/ModuleColumnHeader'
import { WorkItemsGroupedList } from '@/app/work/WorkItemsGroupedList'
import { WorkItemsKanbanPane } from '@/app/work/WorkItemsKanbanPane'
import {
  readWorkContentViewMode,
  persistWorkContentViewMode,
  type WorkContentViewMode
} from '@/app/work/work-view-mode-storage'
import { WorkItemPreviewPanel } from '@/app/work/WorkItemPreviewPanel'
import { WorkflowBoard } from '@/app/workflow/WorkflowBoard'
import type {
  CloudTaskDisplayPatch,
  CloudTaskSaveDraft
} from '@/app/work/CloudTaskWorkItemDetail'
import { loadMasterWorkItems } from '@/app/work-items/load-master-work-items'
import { toggleWorkItemCompleted } from '@/app/work-items/work-item-actions'
import { openWorkItemInCalendar } from '@/app/work-items/work-item-calendar-nav'
import {
  buildWorkItemContextMenuItems,
  type WorkItemContextHandlers
} from '@/app/work-items/work-item-context-menu'
import { flattenVisibleWorkItemViews, workListFilterCounts } from '@/app/work-items/work-item-list-arrange'
import { confirmDeleteCloudTasks } from '@/app/tasks/confirm-delete-cloud-task'
import {
  persistWorkListViewPrefs,
  readWorkListViewPrefs,
  type WorkListViewPrefsV1
} from '@/app/work-items/work-list-view-storage'
import { workItemsToViews } from '@/app/work-items/work-item-mapper'
import type { MailContextHandlers } from '@/lib/mail-context-menu'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import { useCreateCloudTaskUiStore } from '@/stores/create-cloud-task-ui'
import { nextCheckedListSelection } from '@/lib/id-bulk-selection'
import { useBulkListKeyboardShortcuts } from '@/lib/use-bulk-list-keyboard-shortcuts'

export function WorkShell(): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const selectMessage = useMailStore((s) => s.selectMessage)
  const setMessageRead = useMailStore((s) => s.setMessageRead)
  const toggleMessageFlag = useMailStore((s) => s.toggleMessageFlag)
  const archiveMessage = useMailStore((s) => s.archiveMessage)
  const deleteMessage = useMailStore((s) => s.deleteMessage)
  const setTodoForMessage = useMailStore((s) => s.setTodoForMessage)
  const completeTodoForMessage = useMailStore((s) => s.completeTodoForMessage)
  const setWaitingForMessage = useMailStore((s) => s.setWaitingForMessage)
  const clearWaitingForMessage = useMailStore((s) => s.clearWaitingForMessage)
  const refreshNow = useMailStore((s) => s.refreshNow)
  const openReply = useComposeStore((s) => s.openReply)
  const openForward = useComposeStore((s) => s.openForward)
  const openSnoozePicker = useSnoozeUiStore((s) => s.open)
  const setAppMode = useAppModeStore((s) => s.setMode)

  const taskAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts])

  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listViewPrefs, setListViewPrefs] = useState<WorkListViewPrefsV1>(() => readWorkListViewPrefs())
  const [contentViewMode, setContentViewMode] = useState<WorkContentViewMode>(() =>
    readWorkContentViewMode()
  )
  const [selected, setSelected] = useState<WorkItem | null>(null)
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set())
  const selectionAnchorRef = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const views = useMemo(
    () => workItemsToViews(items, accountById, timeZone),
    [items, accountById, timeZone]
  )
  const filterCounts = useMemo(() => workListFilterCounts(views), [views])
  const isKanbanView = contentViewMode === 'kanban'
  const isWorkflowView = contentViewMode === 'workflow'

  const workArrangeCtx = useMemo(
    () => ({
      accountLabel: (id: string): string => {
        const a = accountById.get(id)
        return a?.displayName?.trim() || a?.email || id
      },
      todoBucketLabel: (kind: import('@shared/types').TodoDueKindList) =>
        t(`mail.todoBucket.${kind}` as const),
      noDueLabel: t('work.listArrange.noDue'),
      openLabel: t('work.listArrange.statusOpen'),
      doneLabel: t('work.listArrange.statusDone'),
      mailSourceLabel: t('work.listArrange.sourceMail')
    }),
    [accountById, t]
  )

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const result = await loadMasterWorkItems(taskAccounts, { includeCompletedMail: true })
      setItems(result.items)
      setSelected((prev) => {
        if (!prev) return null
        return result.items.find((i) => i.stableKey === prev.stableKey) ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [taskAccounts])

  useEffect(() => {
    void reload()
  }, [reload])

  const cloudTaskCreatedSignal = useCreateCloudTaskUiStore((s) => s.createdSignal)
  useEffect(() => {
    if (cloudTaskCreatedSignal === 0) return
    void reload()
  }, [cloudTaskCreatedSignal, reload])

  useEffect(() => {
    persistWorkListViewPrefs(listViewPrefs)
  }, [listViewPrefs])

  const handleSelect = useCallback(
    (item: WorkItem): void => {
      setSelected(item)
      if (item.kind === 'mail_todo') {
        void selectMessage(item.messageId)
      }
    },
    [selectMessage]
  )

  const visibleOrderedKeys = useMemo(() => {
    return flattenVisibleWorkItemViews(views, listViewPrefs.arrange, listViewPrefs.chrono, listViewPrefs.filter, workArrangeCtx).map(
      (v) => v.stableKey
    )
  }, [views, listViewPrefs.arrange, listViewPrefs.chrono, listViewPrefs.filter, workArrangeCtx])

  useEffect(() => {
    setCheckedKeys(new Set())
    selectionAnchorRef.current = null
  }, [listViewPrefs.filter, listViewPrefs.arrange, listViewPrefs.chrono])

  const handleItemClick = useCallback(
    (item: WorkItem, event: MouseEvent): void => {
      const key = item.stableKey
      const { checkedKeys: nextChecked, anchor } = nextCheckedListSelection(
        key,
        { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey },
        visibleOrderedKeys,
        checkedKeys,
        selectionAnchorRef.current,
        selected?.stableKey ?? null
      )
      const mod = event.shiftKey || event.ctrlKey || event.metaKey
      if (mod) {
        setCheckedKeys(nextChecked)
        selectionAnchorRef.current = anchor
        handleSelect(item)
        return
      }
      setCheckedKeys(new Set())
      selectionAnchorRef.current = key
      handleSelect(item)
    },
    [visibleOrderedKeys, checkedKeys, selected?.stableKey, handleSelect]
  )

  const clearChecked = useCallback((): void => {
    setCheckedKeys(new Set())
    selectionAnchorRef.current = null
  }, [])

  const selectAllVisible = useCallback((): void => {
    setCheckedKeys(new Set(visibleOrderedKeys))
    if (visibleOrderedKeys.length > 0) {
      selectionAnchorRef.current = visibleOrderedKeys[0]!
    }
  }, [visibleOrderedKeys])

  const deleteChecked = useCallback(async (): Promise<void> => {
    const targets = items.filter(
      (item) => item.kind === 'cloud_task' && checkedKeys.has(item.stableKey)
    )
    if (targets.length === 0) return
    if (!(await confirmDeleteCloudTasks(t, targets.length))) return
    setSaving(true)
    try {
      const deleted = new Set<string>()
      for (const item of targets) {
        if (item.kind !== 'cloud_task') continue
        await window.mailClient.tasks.deleteTask({
          accountId: item.accountId,
          listId: item.listId,
          taskId: item.taskId
        })
        deleted.add(item.stableKey)
      }
      setCheckedKeys((prev) => {
        const next = new Set(prev)
        for (const k of deleted) next.delete(k)
        return next
      })
      setSelected((s) => (s && deleted.has(s.stableKey) ? null : s))
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [items, checkedKeys, reload, t])

  useBulkListKeyboardShortcuts(checkedKeys.size, {
    onDelete: (): void => {
      void deleteChecked()
    },
    onClear: clearChecked,
    onSelectAll: selectAllVisible
  })

  const handleOpenInMail = useCallback((): void => {
    if (selected?.kind !== 'mail_todo') return
    void selectMessage(selected.messageId)
    setAppMode('mail')
  }, [selected, selectMessage, setAppMode])

  const handleToggleCompleted = useCallback(
    async (item: WorkItem): Promise<void> => {
      try {
        await toggleWorkItemCompleted(item)
        await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [reload]
  )

  const saveCloudTask = useCallback(
    async (draft: CloudTaskSaveDraft): Promise<void> => {
      if (!selected || selected.kind !== 'cloud_task') return
      setSaving(true)
      try {
        const taskKey = cloudTaskStableKey(selected.accountId, selected.listId, selected.taskId)
        await window.mailClient.tasks.updateTask({
          accountId: selected.accountId,
          listId: selected.listId,
          taskId: selected.taskId,
          title: draft.title,
          notes: draft.notes || null,
          dueIso: draft.dueIso,
          completed: selected.completed,
          recurrence: draft.recurrence
        })
        if (draft.plannedStartIso && draft.plannedEndIso) {
          await window.mailClient.tasks.setPlannedSchedule({
            taskKey,
            plannedStartIso: draft.plannedStartIso,
            plannedEndIso: draft.plannedEndIso
          })
        } else {
          await window.mailClient.tasks.clearPlannedSchedule({ taskKey })
        }
        await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSaving(false)
      }
    },
    [selected, reload]
  )

  const patchCloudTaskDisplay = useCallback(
    async (patch: CloudTaskDisplayPatch): Promise<void> => {
      if (!selected || selected.kind !== 'cloud_task') return
      try {
        const next = await window.mailClient.tasks.patchTaskDisplay({
          accountId: selected.accountId,
          listId: selected.listId,
          taskId: selected.taskId,
          ...patch
        })
        setSelected((prev) =>
          prev?.kind === 'cloud_task'
            ? {
                ...prev,
                task: next,
                title: next.title?.trim() || prev.title
              }
            : prev
        )
        await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [selected, reload]
  )

  const deleteCloudTask = useCallback(async (): Promise<void> => {
    if (!selected || selected.kind !== 'cloud_task') return
    if (!(await confirmDeleteCloudTasks(t, 1))) return
    setSaving(true)
    try {
      await window.mailClient.tasks.deleteTask({
        accountId: selected.accountId,
        listId: selected.listId,
        taskId: selected.taskId
      })
      setSelected(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [selected, reload, t])

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
        await reload()
      },
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow: async (): Promise<void> => {
        await refreshNow()
        await reload()
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
      reload
    ]
  )

  const workContextHandlers = useMemo<WorkItemContextHandlers>(
    () => ({
      t,
      mailHandlers: mailContextHandlers,
      canCreateCloudTask: (accountId): boolean =>
        taskAccounts.some((a) => a.id === accountId && accountSupportsCloudTasks(a)),
      onToggleCompleted: handleToggleCompleted,
      onShowInCalendar: (item): void => openWorkItemInCalendar(item, setAppMode),
      onOpenInMail: (item): void => {
        void selectMessage(item.messageId)
        setAppMode('mail')
      },
      onOpenInTasks: (_item): void => setAppMode('tasks'),
      onDeleteCloudTask: async (item): Promise<void> => {
        if (!(await confirmDeleteCloudTasks(t, 1))) return
        try {
          await window.mailClient.tasks.deleteTask({
            accountId: item.accountId,
            listId: item.listId,
            taskId: item.taskId
          })
          setSelected((s) => (s?.stableKey === item.stableKey ? null : s))
          await reload()
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      },
      refreshMailList: reload
    }),
    [t, mailContextHandlers, taskAccounts, handleToggleCompleted, setAppMode, selectMessage, reload]
  )

  const workContextHandlersRef = useRef(workContextHandlers)
  workContextHandlersRef.current = workContextHandlers

  const openItemContextMenu = useCallback(
    (item: WorkItem, event: React.MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      void (async (): Promise<void> => {
        const items = await buildWorkItemContextMenuItems(
          item,
          { x: event.clientX, y: event.clientY },
          workContextHandlersRef.current
        )
        setContextMenu({ x: event.clientX, y: event.clientY, items })
      })()
    },
    []
  )

  const visibleCount = views.filter((v) => {
    const f = listViewPrefs.filter
    if (f === 'all') return true
    if (f === 'open') return !v.completed
    if (f === 'completed') return v.completed
    if (f === 'overdue') return !v.completed && v.bucket === 'overdue'
    return true
  }).length

  return (
    <section className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className={cn(moduleColumnHeaderShellBarClass, 'justify-start gap-3 border-b border-border')}>
          <span className="min-w-0 truncate text-xs font-semibold text-foreground">
            {t('work.shell.title')}
          </span>
          <button
            type="button"
            onClick={(): void => void reload()}
            disabled={loading}
            className={moduleColumnHeaderOutlineSmClass}
          >
            <RefreshCw className={cn(moduleColumnHeaderIconGlyphClass, loading && 'animate-spin')} />
            {t('work.shell.refresh')}
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-1.5">
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={(): void => {
                persistWorkContentViewMode('list')
                setContentViewMode('list')
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
                contentViewMode === 'list'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50'
              )}
            >
              <List className="h-3 w-3" />
              {t('work.shell.viewList')}
            </button>
            <button
              type="button"
              onClick={(): void => {
                persistWorkContentViewMode('kanban')
                setContentViewMode('kanban')
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
                contentViewMode === 'kanban'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50'
              )}
            >
              <Columns3 className="h-3 w-3" />
              {t('work.shell.viewKanban')}
            </button>
            <button
              type="button"
              onClick={(): void => {
                persistWorkContentViewMode('workflow')
                setContentViewMode('workflow')
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
                contentViewMode === 'workflow'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50'
              )}
            >
              <LayoutGrid className="h-3 w-3" />
              {t('work.shell.viewWorkflow')}
            </button>
          </div>
          {!isWorkflowView ? (
          <div className="min-w-0 flex-1">
            <TasksListViewMenu
              arrange={listViewPrefs.arrange}
              chrono={listViewPrefs.chrono}
              filter={listViewPrefs.filter}
              filterCounts={filterCounts}
              showAccountArrange
              onArrangeChange={(v): void => setListViewPrefs((p) => ({ ...p, arrange: v }))}
              onChronoChange={(v): void => setListViewPrefs((p) => ({ ...p, chrono: v }))}
              onFilterChange={(v): void => setListViewPrefs((p) => ({ ...p, filter: v }))}
              disabled={loading}
            />
          </div>
          ) : (
            <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
              {t('workflow.introHint')}
            </p>
          )}
          {!isWorkflowView ? (
          <div className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {visibleCount}{' '}
            {visibleCount === 1 ? t('work.shell.item_one') : t('work.shell.item_other')}
          </div>
          ) : null}
        </div>

        {isWorkflowView ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <WorkflowBoard />
          </div>
        ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div
              className={cn(
                'min-h-0 flex-1',
                isKanbanView ? 'overflow-hidden' : 'overflow-y-auto'
              )}
            >
              {loading && items.length === 0 ? (
                <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : error ? (
                <p className="p-4 text-xs text-destructive">{error}</p>
              ) : items.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">{t('work.shell.empty')}</p>
              ) : isKanbanView ? (
                <WorkItemsKanbanPane
                  items={items}
                  accounts={accounts}
                  filter={listViewPrefs.filter}
                  chrono={listViewPrefs.chrono}
                  arrangeCtx={workArrangeCtx}
                  selectedKey={selected?.stableKey ?? null}
                  onSelect={handleSelect}
                  onItemsMutated={reload}
                />
              ) : (
                <WorkItemsGroupedList
                  items={items}
                  accounts={accounts}
                  arrange={listViewPrefs.arrange}
                  chrono={listViewPrefs.chrono}
                  filter={listViewPrefs.filter}
                  selectedKey={selected?.stableKey ?? null}
                  checkedKeys={checkedKeys}
                  onSelect={handleSelect}
                  onItemClick={handleItemClick}
                  onToggleCompleted={(item): void => void handleToggleCompleted(item)}
                  onContextMenu={openItemContextMenu}
                />
              )}
            </div>
          </div>

          <div className="flex min-h-0 w-full shrink-0 flex-col bg-card lg:w-[380px]">
            <div className="shrink-0 border-b border-border px-3 py-2">
              <h2 className="text-xs font-semibold text-foreground">{t('work.shell.detailHeading')}</h2>
            </div>
            <WorkItemPreviewPanel
              item={selected}
              accountById={accountById}
              saving={saving}
              onOpenInMail={handleOpenInMail}
              onCloudSave={saveCloudTask}
              onCloudDelete={deleteCloudTask}
              onCloudDisplayChange={patchCloudTaskDisplay}
            />
          </div>
        </div>
        )}
      </main>

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={(): void => setContextMenu(null)}
        />
      ) : null}
    </section>
  )
}
