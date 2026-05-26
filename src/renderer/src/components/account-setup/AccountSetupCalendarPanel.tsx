import { useCallback, useState } from 'react'
import { Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/app-mode'
import {
  patchCalendarSettingsPrefs,
  readCalendarSettingsPrefs,
  resetCalendarSettingsPrefs,
  CALENDAR_FC_VIEW_OPTIONS,
  type CalendarSettingsPrefsV1,
  type CalendarWeekStart
} from '@/lib/calendar-settings-prefs'
import { useCalendarSettingsPrefs } from '@/lib/use-calendar-settings-prefs'
import { viewIdToLabel } from '@/app/calendar/calendar-shell-view-helpers'
import { GANTT_TIMELINE_SCALES, type GanttTimelineScale } from '@/app/calendar/calendar-gantt-scale'
import {
  isTimeGridSlotMinutes,
  TIME_GRID_SLOT_MINUTES_OPTIONS,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'
import {
  persistTimelineAutoDismissEndedEvents,
  readTimelineAutoDismissEndedEvents
} from '@/app/calendar/calendar-event-dismiss-storage'
import type { TimelineWindowSize } from '@/app/calendar/timeline-window-storage'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return { value: `${pad(h)}:00:00`, label: `${pad(h)}:00` }
})

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

export interface AccountSetupCalendarPanelProps {
  section: string
  onClose: () => void
}

/** Einstellungen → Kalender — Darstellung, Layer, Panels, Zeitliste. */
export default function AccountSetupCalendarPanel({
  section,
  onClose
}: AccountSetupCalendarPanelProps): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const prefs = useCalendarSettingsPrefs()
  const [, bump] = useState(0)
  const refresh = useCallback((): void => bump((n) => n + 1), [])

  const apply = useCallback(
    (patch: Partial<CalendarSettingsPrefsV1>): void => {
      patchCalendarSettingsPrefs(patch)
      if (patch.timelineAutoDismissEndedEvents !== undefined) {
        persistTimelineAutoDismissEndedEvents(patch.timelineAutoDismissEndedEvents)
      }
      refresh()
    },
    [refresh]
  )

  const selectClass =
    'w-full max-w-md rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring'

  return (
    <div role="tabpanel" aria-label={t('settings.calendarPanelAria')} className="space-y-5">
      {section === 'workspace' && (
        <section className="space-y-2 rounded-md bg-background/60 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {t('settings.calendarWorkspaceHeading')}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.calendarWorkspaceIntro')}</p>
          <button
            type="button"
            onClick={(): void => {
              setAppMode('calendar')
              onClose()
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {t('settings.calendarOpenModule')}
          </button>
        </section>
      )}

      {section === 'display' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.calendarDisplayHeading')}
          </h3>

          <SettingsField label={t('settings.calendarDefaultViewLabel')} hint={t('settings.calendarDefaultViewHint')}>
            <select
              value={prefs.defaultFcView}
              onChange={(e): void => apply({ defaultFcView: e.target.value })}
              className={selectClass}
            >
              {CALENDAR_FC_VIEW_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {viewIdToLabel(v, t)}
                </option>
              ))}
            </select>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.rememberLastFcView}
              onChange={(e): void => apply({ rememberLastFcView: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.calendarRememberViewLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">{t('settings.calendarRememberViewHint')}</span>
            </span>
          </label>

          <SettingsField label={t('settings.calendarWeekStartLabel')}>
            <select
              value={String(prefs.weekStartsOn)}
              onChange={(e): void =>
                apply({ weekStartsOn: Number(e.target.value) as CalendarWeekStart })
              }
              className={selectClass}
            >
              <option value="1">{t('settings.calendarWeekStartMonday')}</option>
              <option value="0">{t('settings.calendarWeekStartSunday')}</option>
            </select>
          </SettingsField>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.hideWeekends}
              onChange={(e): void => apply({ hideWeekends: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.calendarHideWeekendsLabel')}</span>
          </label>

          <SettingsField label={t('settings.calendarSlotMinutesLabel')}>
            <select
              value={prefs.defaultTimeGridSlotMinutes}
              onChange={(e): void => {
                const n = Number(e.target.value)
                if (isTimeGridSlotMinutes(n)) apply({ defaultTimeGridSlotMinutes: n })
              }}
              className={selectClass}
            >
              {TIME_GRID_SLOT_MINUTES_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {t('calendar.header.slotMinutesOption', { count: m })}
                </option>
              ))}
            </select>
          </SettingsField>

          <div className="grid gap-3 sm:grid-cols-3">
            <SettingsField label={t('settings.calendarSlotMinLabel')}>
              <select
                value={prefs.slotMinTime}
                onChange={(e): void => apply({ slotMinTime: e.target.value })}
                className={selectClass}
              >
                {HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SettingsField>
            <SettingsField label={t('settings.calendarSlotMaxLabel')}>
              <select
                value={prefs.slotMaxTime}
                onChange={(e): void => apply({ slotMaxTime: e.target.value })}
                className={selectClass}
              >
                {HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SettingsField>
            <SettingsField label={t('settings.calendarScrollTimeLabel')}>
              <select
                value={prefs.scrollTime}
                onChange={(e): void => apply({ scrollTime: e.target.value })}
                className={selectClass}
              >
                {HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SettingsField>
          </div>

          <SettingsField label={t('settings.calendarGanttScaleLabel')}>
            <select
              value={prefs.defaultGanttTimelineScale}
              onChange={(e): void =>
                apply({ defaultGanttTimelineScale: e.target.value as GanttTimelineScale })
              }
              className={selectClass}
            >
              {GANTT_TIMELINE_SCALES.map((s) => (
                <option key={s} value={s}>
                  {t(`calendar.gantt.scales.${s}` as const)}
                </option>
              ))}
            </select>
          </SettingsField>
        </section>
      )}

      {section === 'layers' && (
        <section className="space-y-3 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.calendarLayersHeading')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('settings.calendarLayersIntro')}</p>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultMailTodoOverlay}
              onChange={(e): void => apply({ defaultMailTodoOverlay: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.calendarLayerMailTodos')}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultCloudTaskOverlay}
              onChange={(e): void => apply({ defaultCloudTaskOverlay: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.calendarLayerCloudTasks')}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultUserNoteOverlay}
              onChange={(e): void => apply({ defaultUserNoteOverlay: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.calendarLayerNotes')}</span>
          </label>
        </section>
      )}

      {section === 'panels' && (
        <section className="space-y-3 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.calendarPanelsHeading')}
          </h3>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultRightInboxOpen}
              onChange={(e): void => apply({ defaultRightInboxOpen: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.calendarPanelInbox')}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultRightPreviewOpen}
              onChange={(e): void => apply({ defaultRightPreviewOpen: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.calendarPanelPreview')}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={prefs.defaultLeftSidebarCollapsed}
              onChange={(e): void => apply({ defaultLeftSidebarCollapsed: e.target.checked })}
              className="mt-0.5"
            />
            <span className="font-medium">{t('settings.calendarPanelLeftCollapsed')}</span>
          </label>
        </section>
      )}

      {section === 'timeline' && (
        <section className="space-y-4 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.calendarTimelineHeading')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('settings.calendarTimelineIntro')}</p>
          <SettingsField label={t('settings.calendarTimelineWindowLabel')}>
            <select
              value={prefs.defaultTimelineWindowSize}
              onChange={(e): void =>
                apply({ defaultTimelineWindowSize: e.target.value as TimelineWindowSize })
              }
              className={selectClass}
            >
              <option value="week">{t('settings.calendarTimelineWeek')}</option>
              <option value="month">{t('settings.calendarTimelineMonth')}</option>
              <option value="quarter">{t('settings.calendarTimelineQuarter')}</option>
            </select>
          </SettingsField>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={readTimelineAutoDismissEndedEvents()}
              onChange={(e): void => {
                const v = e.target.checked
                apply({ timelineAutoDismissEndedEvents: v })
                persistTimelineAutoDismissEndedEvents(v)
              }}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('settings.calendarTimelineAutoDismissLabel')}</span>
              <span className="mt-0.5 block text-muted-foreground">
                {t('settings.calendarTimelineAutoDismissHint')}
              </span>
            </span>
          </label>
        </section>
      )}

      {section === 'advanced' && (
        <section className="space-y-3 rounded-md bg-background/60 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('settings.calendarAdvancedHeading')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('settings.calendarAdvancedIntro')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(): void => {
                window.dispatchEvent(
                  new CustomEvent('mailclient:settings-calendar-subnav', { detail: { id: 'timezone' } })
                )
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
            >
              {t('settings.calendarTzHeading')}
            </button>
            <button
              type="button"
              onClick={(): void => {
                window.dispatchEvent(
                  new CustomEvent('mailclient:settings-calendar-subnav', { detail: { id: 'bookWithMe' } })
                )
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
            >
              {t('settings.bookWithMeHeading')}
            </button>
            <button
              type="button"
              onClick={(): void => {
                window.dispatchEvent(
                  new CustomEvent('mailclient:settings-calendar-subnav', { detail: { id: 'api' } })
                )
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
            >
              {t('settings.calendarApiHeading')}
            </button>
            <button
              type="button"
              onClick={(): void => {
                window.dispatchEvent(
                  new CustomEvent('mailclient:settings-calendar-subnav', { detail: { id: 'sidebar' } })
                )
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
            >
              {t('settings.calendarSidebarHeading')}
            </button>
          </div>
        </section>
      )}

      <div className="px-1">
        <button
          type="button"
          onClick={(): void => {
            resetCalendarSettingsPrefs()
            persistTimelineAutoDismissEndedEvents(readCalendarSettingsPrefs().timelineAutoDismissEndedEvents)
            refresh()
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t('settings.calendarResetAll')}
        </button>
      </div>
    </div>
  )
}
