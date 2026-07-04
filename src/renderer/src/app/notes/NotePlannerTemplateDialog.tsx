import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NotePlannerTemplateKind } from '@/lib/note-page-templates'
import {
  buildPlannerNoteTitle,
  buildPlannerTemplateBody,
  fitnessMetricColumnLetters,
  type NotePlannerBuildOptions
} from '@/lib/note-planner-templates'
import { resolveNotesCalendarDisplayPrefs } from '@/lib/notes-calendar-display'
import { useNotesSettingsPrefs } from '@/lib/use-notes-settings-prefs'
import { MiniMonthGrid } from '@/app/calendar/MiniMonthGrid'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import { cn } from '@/lib/utils'

export interface NotePlannerCreateResult {
  title: string
  bodyHtml: string
}

function formatTimeLabel(value: string): string {
  return value.slice(0, 5)
}

export function NotePlannerTemplateDialog({
  open,
  kind,
  onClose,
  onCreate
}: {
  open: boolean
  kind: NotePlannerTemplateKind
  onClose: () => void
  onCreate: (result: NotePlannerCreateResult) => void | Promise<void>
}): JSX.Element | null {
  const { t } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const notesSettings = useNotesSettingsPrefs()
  const calDisplay = useMemo(
    () => resolveNotesCalendarDisplayPrefs(notesSettings),
    [notesSettings]
  )

  const [weekAnchor, setWeekAnchor] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: calDisplay.weekStartsOn })
  )
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))
  const [dayAnchor, setDayAnchor] = useState(() => startOfDay(new Date()))
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    const now = new Date()
    setWeekAnchor(startOfWeek(now, { weekStartsOn: calDisplay.weekStartsOn }))
    setMonthAnchor(startOfMonth(now))
    setDayAnchor(startOfDay(now))
    setCreating(false)
  }, [open, calDisplay.weekStartsOn])

  const plannerLabels = useMemo(
    () => ({
      weekShort: t('notes.plannerDialog.weekShort'),
      sectionGeneral: t('notes.plannerDialog.sectionGeneral'),
      sectionNotes: t('notes.plannerDialog.sectionNotes'),
      sectionTasks: t('notes.plannerDialog.sectionTasks'),
      sectionSchedule: t('notes.plannerDialog.sectionSchedule'),
      dayColumn: t('notes.plannerDialog.dayColumn'),
      fitnessTitlePrefix: t('notes.plannerDialog.fitnessTitlePrefix'),
      fitnessColumns: fitnessMetricColumnLetters(),
      weekdaysLong: [
        t('notes.plannerDialog.weekday.mon'),
        t('notes.plannerDialog.weekday.tue'),
        t('notes.plannerDialog.weekday.wed'),
        t('notes.plannerDialog.weekday.thu'),
        t('notes.plannerDialog.weekday.fri'),
        t('notes.plannerDialog.weekday.sat'),
        t('notes.plannerDialog.weekday.sun')
      ] as const,
      dailyPlannerTitlePrefix: t('notes.dailyPlanner.titlePrefix'),
      dailyScheduleDay: `${formatTimeLabel(calDisplay.slotMinTime)} – ${formatTimeLabel(calDisplay.slotMaxTime)}`,
      dailyScheduleNight: t('notes.dailyPlanner.scheduleNight'),
      dailyChecklist: t('notes.dailyPlanner.checklist'),
      dailyPriority: t('notes.dailyPlanner.priority'),
      dailyAction: t('notes.dailyPlanner.action'),
      dailyPlainList: t('notes.dailyPlanner.plainList'),
      dailyGridNotes: t('notes.dailyPlanner.gridNotes'),
      dailyLinedNotes: t('notes.dailyPlanner.linedNotes'),
      dailyQuadrantNotes: t('notes.dailyPlanner.quadrantNotes')
    }),
    [calDisplay.slotMaxTime, calDisplay.slotMinTime, t]
  )

  const buildOptions = useMemo(
    (): NotePlannerBuildOptions => ({
      weekStartsOn: calDisplay.weekStartsOn,
      slotMinTime: calDisplay.slotMinTime,
      slotMaxTime: calDisplay.slotMaxTime,
      slotMinutes: calDisplay.defaultTimeGridSlotMinutes,
      locale: dfLocale,
      labels: plannerLabels
    }),
    [calDisplay, dfLocale, plannerLabels]
  )

  const anchor =
    kind === 'weeklyOverview'
      ? weekAnchor
      : kind === 'dailyPlanner'
        ? dayAnchor
        : monthAnchor
  const previewTitle = buildPlannerNoteTitle(kind, anchor, buildOptions)

  const handleCreate = useCallback(async (): Promise<void> => {
    setCreating(true)
    try {
      await onCreate({
        title: previewTitle,
        bodyHtml: buildPlannerTemplateBody(kind, anchor, buildOptions)
      })
      onClose()
    } finally {
      setCreating(false)
    }
  }, [anchor, buildOptions, kind, onClose, onCreate, previewTitle])

  const titleKey =
    kind === 'weeklyOverview'
      ? 'notes.plannerDialog.weeklyTitle'
      : kind === 'monthlyFitnessTracker'
        ? 'notes.plannerDialog.fitnessTitle'
        : kind === 'dailyPlanner'
          ? 'notes.plannerDialog.dailyTitle'
          : 'notes.plannerDialog.monthlyTitle'

  return (
    <ModalRoot open={open} onBackdropClick={creating ? undefined : onClose}>
      <ModalPanel className="flex max-h-[min(90vh,640px)] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t(titleKey)}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('notes.plannerDialog.hint')}</p>
        </header>

        <div className="space-y-3 px-4 py-3">
          {kind === 'weeklyOverview' ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-2">
              <button
                type="button"
                onClick={(): void => setWeekAnchor((d) => addWeeks(d, -1))}
                disabled={creating}
                className="rounded-sm p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
                aria-label={t('notes.plannerDialog.prevWeek')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 text-center">
                <div className="truncate text-sm font-medium capitalize text-foreground">
                  {previewTitle}
                </div>
                <div className="text-2xs text-muted-foreground">
                  {format(weekAnchor, 'EEEE, dd.MM.yyyy', { locale: dfLocale })}
                </div>
              </div>
              <button
                type="button"
                onClick={(): void => setWeekAnchor((d) => addWeeks(d, 1))}
                disabled={creating}
                className="rounded-sm p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
                aria-label={t('notes.plannerDialog.nextWeek')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : kind === 'dailyPlanner' ? (
            <>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-2">
                <button
                  type="button"
                  onClick={(): void => setDayAnchor((d) => addDays(d, -1))}
                  disabled={creating}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  aria-label={t('notes.plannerDialog.prevDay')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 text-center">
                  <div className="truncate text-sm font-medium capitalize text-foreground">
                    {previewTitle}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(): void => setDayAnchor((d) => addDays(d, 1))}
                  disabled={creating}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  aria-label={t('notes.plannerDialog.nextDay')}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <MiniMonthGrid
                monthAnchor={dayAnchor}
                onPrevMonth={(): void => setDayAnchor((d) => addMonths(d, -1))}
                onNextMonth={(): void => setDayAnchor((d) => addMonths(d, 1))}
                onDayClick={(day): void => setDayAnchor(startOfDay(day))}
                selectedRange={{ startInclusive: dayAnchor, endInclusive: dayAnchor }}
                compact
              />
            </>
          ) : (
            <MiniMonthGrid
              monthAnchor={monthAnchor}
              onPrevMonth={(): void => setMonthAnchor((d) => addMonths(d, -1))}
              onNextMonth={(): void => setMonthAnchor((d) => addMonths(d, 1))}
              onDayClick={(day): void => setMonthAnchor(startOfMonth(day))}
              compact
            />
          )}

          <div className="rounded-md border border-dashed border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t('notes.plannerDialog.previewLabel')}:</span>{' '}
            {previewTitle}
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={(): void => void handleCreate()}
            disabled={creating}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
            )}
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('notes.plannerDialog.create')}
          </button>
        </footer>
      </ModalPanel>
    </ModalRoot>
  )
}
