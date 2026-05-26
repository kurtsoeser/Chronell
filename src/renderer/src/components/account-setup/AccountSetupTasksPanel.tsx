import { useCallback, useState } from 'react'
import { ListTodo } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/app-mode'
import { requestOpenAccountSettings } from '@/lib/open-account-settings'
import { useTasksDetailPanelLayoutStore } from '@/stores/tasks-detail-panel-layout'
import {
  TASKS_OVERDUE_HIGHLIGHT_DEFAULT_COLOR,
  patchTasksSettingsPrefs,
  readTasksSettingsPrefs,
  resetTasksSettingsPrefs,
  type TasksCollapsedGroupsMode,
  type TasksDefaultDueOnCreate,
  type TasksNoDuePlacement,
  type TasksOverdueMode,
  type TasksSettingsPrefsV1
} from '@/lib/tasks-settings-prefs'
import { useTasksSettingsPrefs } from '@/lib/use-tasks-settings-prefs'
import type { TaskListArrangeBy, TaskListChronoOrder, TaskListFilter } from '@/app/tasks/task-list-arrange'
import type { TasksContentViewMode } from '@/app/tasks/tasks-view-mode-storage'
import type { CloudTaskCalendarDateMode } from '@/app/calendar/cloud-task-calendar'
import { readTasksCalendarFcView, persistTasksCalendarFcView } from '@/app/tasks/tasks-calendar-view-storage'
import { viewIdToLabel } from '@/app/calendar/calendar-shell-view-helpers'

const FC_VIEWS = ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek'] as const

function SettingsField({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <label className="block space-y-1 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      {hint ? <span className="block text-2xs leading-relaxed text-muted-foreground">{hint}</span> : null}
      {children}
    </label>
  )
}

export interface AccountSetupTasksPanelProps {
  section: string
  onClose: () => void
}

/** Einstellungen → Aufgaben */
export default function AccountSetupTasksPanel({
  section,
  onClose
}: AccountSetupTasksPanelProps): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const setDetailPlacement = useTasksDetailPanelLayoutStore((s) => s.setDetailPlacement)
  const prefs = useTasksSettingsPrefs()
  const [, bump] = useState(0)
  const refresh = useCallback((): void => bump((n) => n + 1), [])

  const apply = useCallback(
    (patch: Partial<TasksSettingsPrefsV1>): void => {
      patchTasksSettingsPrefs(patch)
      if (patch.defaultDetailPlacement) setDetailPlacement(patch.defaultDetailPlacement)
      refresh()
    },
    [refresh, setDetailPlacement]
  )

  const selectClass =
    'w-full max-w-md rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring'

  return (
    <div role="tabpanel" aria-label={t('settings.tasksPanelAria')} className="space-y-5">
      {section === 'workspace' && (
        <section className="space-y-2 rounded-md bg-background/60 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListTodo className="h-3.5 w-3.5" aria-hidden />
            {t('settings.tasksWorkspaceHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.tasksWorkspaceIntro')}</p>
          <button
            type="button"
            onClick={(): void => {
              setAppMode('tasks')
              onClose()
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {t('settings.tasksOpenModule')}
          </button>
        </section>
      )}

      {section === 'display' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.tasksDisplayHeading')}
          </h3>

          <SettingsField label={t('settings.tasksDefaultViewLabel')} hint={t('settings.tasksDefaultViewHint')}>
            <select
              value={prefs.defaultContentViewMode}
              onChange={(e): void => {
                apply({ defaultContentViewMode: e.target.value as TasksContentViewMode })
              }}
              className={selectClass}
            >
              <option value="list">{t('settings.tasksViewList')}</option>
              <option value="kanban">{t('settings.tasksViewKanban')}</option>
            </select>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.compactListRows}
              onChange={(e): void => apply({ compactListRows: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.tasksCompactRowsLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">{t('settings.tasksCompactRowsHint')}</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.showAccountStripe}
              onChange={(e): void => apply({ showAccountStripe: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.tasksAccountStripeLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">{t('settings.tasksAccountStripeHint')}</span>
            </span>
          </label>

          <hr className="border-border/60" />
          <p className="text-xs text-muted-foreground">{t('settings.tasksOverdueIntro')}</p>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.overdueHighlightEnabled}
              onChange={(e): void => apply({ overdueHighlightEnabled: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.tasksOverdueEnabledLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">{t('settings.tasksOverdueEnabledHint')}</span>
            </span>
          </label>

          <SettingsField label={t('settings.tasksOverdueModeLabel')} hint={t('settings.tasksOverdueModeHint')}>
            <select
              value={prefs.overdueMode}
              disabled={!prefs.overdueHighlightEnabled}
              onChange={(e): void => apply({ overdueMode: e.target.value as TasksOverdueMode })}
              className={selectClass}
            >
              <option value="start_of_day">{t('settings.tasksOverdueModeStartOfDay')}</option>
              <option value="due_datetime">{t('settings.tasksOverdueModeDueDatetime')}</option>
            </select>
          </SettingsField>

          <div className={cn(!prefs.overdueHighlightEnabled && 'pointer-events-none opacity-50')}>
            <SettingsField label={t('settings.tasksOverdueColorLabel')} hint={t('settings.tasksOverdueColorHint')}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={prefs.overdueHighlightColor}
                  onChange={(e): void => apply({ overdueHighlightColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-background p-0.5"
                />
                <button
                  type="button"
                  onClick={(): void =>
                    apply({ overdueHighlightColor: TASKS_OVERDUE_HIGHLIGHT_DEFAULT_COLOR })
                  }
                  className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60"
                >
                  {t('settings.tasksOverdueColorReset')}
                </button>
              </div>
            </SettingsField>
          </div>
        </section>
      )}

      {section === 'list' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.tasksListHeading')}
          </h3>

          <SettingsField label={t('settings.tasksDefaultArrangeLabel')}>
            <select
              value={prefs.defaultArrange}
              onChange={(e): void => apply({ defaultArrange: e.target.value as TaskListArrangeBy })}
              className={selectClass}
            >
              {(
                [
                  'calendar_day',
                  'todo_bucket',
                  'due_date',
                  'item_type',
                  'status',
                  'title',
                  'list',
                  'account',
                  'none'
                ] as const
              ).map((k) => (
                <option key={k} value={k}>
                  {t(`tasks.listArrange.${k}`)}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsField label={t('settings.tasksDefaultChronoLabel')}>
            <select
              value={prefs.defaultChrono}
              onChange={(e): void => apply({ defaultChrono: e.target.value as TaskListChronoOrder })}
              className={selectClass}
            >
              <option value="newest_on_top">{t('settings.tasksChronoNewest')}</option>
              <option value="oldest_on_top">{t('settings.tasksChronoOldest')}</option>
            </select>
          </SettingsField>

          <SettingsField label={t('settings.tasksDefaultFilterLabel')}>
            <select
              value={prefs.defaultFilter}
              onChange={(e): void => apply({ defaultFilter: e.target.value as TaskListFilter })}
              className={selectClass}
            >
              <option value="all">{t('settings.tasksFilterAll')}</option>
              <option value="open">{t('settings.tasksFilterOpen')}</option>
              <option value="completed">{t('settings.tasksFilterCompleted')}</option>
              <option value="overdue">{t('settings.tasksFilterOverdue')}</option>
            </select>
          </SettingsField>

          <SettingsField label={t('settings.tasksCollapsedGroupsLabel')} hint={t('settings.tasksCollapsedGroupsHint')}>
            <select
              value={prefs.collapsedGroupsMode}
              onChange={(e): void =>
                apply({ collapsedGroupsMode: e.target.value as TasksCollapsedGroupsMode })
              }
              className={selectClass}
            >
              <option value="done_only">{t('settings.tasksCollapsedDoneOnly')}</option>
              <option value="done_and_later">{t('settings.tasksCollapsedDoneAndLater')}</option>
              <option value="none">{t('settings.tasksCollapsedNone')}</option>
            </select>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.listDragEnabled}
              onChange={(e): void => apply({ listDragEnabled: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.tasksListDragLabel')}</span>
          </label>
        </section>
      )}

      {section === 'due' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.tasksDueHeading')}
          </h3>

          <SettingsField label={t('settings.tasksNoDuePlacementLabel')} hint={t('settings.tasksNoDuePlacementHint')}>
            <select
              value={prefs.noDuePlacement}
              onChange={(e): void => apply({ noDuePlacement: e.target.value as TasksNoDuePlacement })}
              className={selectClass}
            >
              <option value="group">{t('settings.tasksNoDueGroup')}</option>
              <option value="bottom">{t('settings.tasksNoDueBottom')}</option>
              <option value="hide">{t('settings.tasksNoDueHide')}</option>
            </select>
          </SettingsField>

          <SettingsField label={t('settings.tasksDefaultDueCreateLabel')}>
            <select
              value={prefs.defaultDueOnCreate}
              onChange={(e): void =>
                apply({ defaultDueOnCreate: e.target.value as TasksDefaultDueOnCreate })
              }
              className={selectClass}
            >
              <option value="none">{t('settings.tasksDueCreateNone')}</option>
              <option value="today">{t('settings.tasksDueCreateToday')}</option>
              <option value="tomorrow">{t('settings.tasksDueCreateTomorrow')}</option>
              <option value="next_week">{t('settings.tasksDueCreateNextWeek')}</option>
            </select>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.dueReminderEnabled}
              onChange={(e): void => apply({ dueReminderEnabled: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.tasksDueReminderLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">{t('settings.tasksDueReminderHint')}</span>
            </span>
          </label>

          <SettingsField label={t('settings.tasksDueReminderMinutesLabel')}>
            <input
              type="number"
              min={5}
              max={10080}
              step={5}
              disabled={!prefs.dueReminderEnabled}
              value={prefs.dueReminderMinutesBefore}
              onChange={(e): void =>
                apply({ dueReminderMinutesBefore: Number(e.target.value) || 60 })
              }
              className={cn(selectClass, 'max-w-[8rem]')}
            />
          </SettingsField>
        </section>
      )}

      {section === 'kanban' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.tasksKanbanHeading')}
          </h3>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.kanbanHideDoneColumn}
              onChange={(e): void => apply({ kanbanHideDoneColumn: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.tasksKanbanHideDoneLabel')}</span>
          </label>

          <SettingsField label={t('settings.tasksCalendarViewLabel')}>
            <select
              value={readTasksCalendarFcView()}
              onChange={(e): void => {
                persistTasksCalendarFcView(e.target.value)
                apply({ defaultCalendarFcView: e.target.value })
              }}
              className={selectClass}
            >
              {FC_VIEWS.map((v) => (
                <option key={v} value={v}>
                  {viewIdToLabel(v, t)}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsField label={t('settings.tasksCalendarDateModeLabel')}>
            <select
              value={prefs.defaultCalendarDateMode}
              onChange={(e): void =>
                apply({ defaultCalendarDateMode: e.target.value as CloudTaskCalendarDateMode })
              }
              className={selectClass}
            >
              <option value="due">{t('settings.tasksDateModeDue')}</option>
              <option value="planned">{t('settings.tasksDateModePlanned')}</option>
            </select>
          </SettingsField>
        </section>
      )}

      {section === 'mail' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.tasksMailHeading')}
          </h3>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.includeMailTodosInList}
              onChange={(e): void => apply({ includeMailTodosInList: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.tasksIncludeMailTodosLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">
                {t('settings.tasksIncludeMailTodosHint')}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.unflagMailOnComplete}
              onChange={(e): void => apply({ unflagMailOnComplete: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.tasksUnflagOnCompleteLabel')}</span>
          </label>
          <p className="text-2xs text-muted-foreground">{t('settings.tasksOverdueWorkHint')}</p>
        </section>
      )}

      {section === 'detail' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.tasksDetailHeading')}
          </h3>
          <SettingsField label={t('settings.tasksDetailPlacementLabel')}>
            <select
              value={prefs.defaultDetailPlacement}
              onChange={(e): void =>
                apply({
                  defaultDetailPlacement: e.target.value as TasksSettingsPrefsV1['defaultDetailPlacement']
                })
              }
              className={selectClass}
            >
              <option value="dock">{t('settings.tasksDetailDock')}</option>
              <option value="float">{t('settings.tasksDetailFloat')}</option>
            </select>
          </SettingsField>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultDetailOpen}
              onChange={(e): void => apply({ defaultDetailOpen: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.tasksDetailOpenDefaultLabel')}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.inlineCreateShowNotes}
              onChange={(e): void => apply({ inlineCreateShowNotes: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.tasksInlineNotesLabel')}</span>
          </label>
          <button
            type="button"
            onClick={(): void => {
              requestOpenAccountSettings({ tab: 'mail', mailSubNav: 'triage' })
              onClose()
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
          >
            {t('settings.tasksWorkflowLink')}
          </button>
        </section>
      )}

      {section === 'sync' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.tasksSyncHeading')}
          </h3>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.rememberLastListSelection}
              onChange={(e): void => apply({ rememberLastListSelection: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.tasksRememberSelectionLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">
                {t('settings.tasksRememberSelectionHint')}
              </span>
            </span>
          </label>
          <SettingsField label={t('settings.tasksBackgroundSyncLabel')} hint={t('settings.tasksBackgroundSyncHint')}>
            <select
              value={String(prefs.backgroundSyncIntervalMinutes)}
              onChange={(e): void =>
                apply({ backgroundSyncIntervalMinutes: Number(e.target.value) })
              }
              className={selectClass}
            >
              <option value="0">{t('settings.tasksSyncOff')}</option>
              <option value="2">2 {t('settings.tasksSyncMinutes')}</option>
              <option value="5">5 {t('settings.tasksSyncMinutes')}</option>
              <option value="15">15 {t('settings.tasksSyncMinutes')}</option>
              <option value="30">30 {t('settings.tasksSyncMinutes')}</option>
            </select>
          </SettingsField>
          <button
            type="button"
            onClick={(): void => {
              requestOpenAccountSettings({ tab: 'accounts' })
              onClose()
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
          >
            {t('settings.tasksCacheAccountsLink')}
          </button>
        </section>
      )}

      <div className="px-1">
        <button
          type="button"
          onClick={(): void => {
            resetTasksSettingsPrefs()
            refresh()
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t('settings.tasksResetAll')}
        </button>
      </div>
    </div>
  )
}
