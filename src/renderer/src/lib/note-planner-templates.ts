import type { Locale } from 'date-fns'
import {
  addDays,
  addMinutes,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  getISOWeek,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import type { NotePlannerTemplateKind } from '@/lib/note-page-templates'
import { buildDailyPlannerHtml, type DailyPlannerLabels } from '@/lib/note-daily-planner-template'

export type { NotePlannerTemplateKind }

export const PARAMETRIC_PLANNER_TEMPLATE_IDS = new Set<NotePlannerTemplateKind>([
  'weeklyOverview',
  'monthlyOverview',
  'monthlyFitnessTracker',
  'dailyPlanner'
])

export function isParametricPlannerTemplateId(id: string): id is NotePlannerTemplateKind {
  return PARAMETRIC_PLANNER_TEMPLATE_IDS.has(id as NotePlannerTemplateKind)
}

export interface NotePlannerLabels {
  weekShort: string
  sectionGeneral: string
  sectionNotes: string
  sectionTasks: string
  sectionSchedule: string
  dayColumn: string
  fitnessTitlePrefix: string
  fitnessColumns: readonly string[]
  weekdaysLong: readonly string[]
  dailyPlannerTitlePrefix: string
  dailyScheduleDay: string
  dailyScheduleNight: string
  dailyChecklist: string
  dailyPriority: string
  dailyAction: string
  dailyPlainList: string
  dailyGridNotes: string
  dailyLinedNotes: string
  dailyQuadrantNotes: string
}

export interface NotePlannerBuildOptions {
  weekStartsOn: 0 | 1
  slotMinTime: string
  slotMaxTime: string
  slotMinutes: number
  locale: Locale
  labels: NotePlannerLabels
}

const PLANNER_HEADER_WEEKDAY_BG = '#2d2d2d'
const PLANNER_HEADER_SAT_BG = '#1e4a7a'
const PLANNER_HEADER_SUN_BG = '#8b4040'
const PLANNER_COL_SAT_BG = '#d6e8f7'
const PLANNER_COL_SUN_BG = '#f7d6d6'
const PLANNER_KW_BG = '#ececec'
const PLANNER_DATE_BAR_BG = '#ececec'

const TASK_ITEM = (label = ''): string =>
  `<li data-checked="false" data-type="taskItem"><p>${label}</p></li>`

const TASK_LIST = (...items: string[]): string =>
  `<ul data-type="taskList">${items.join('')}</ul>`

function cellP(lines = 1, text = ''): string {
  if (text) return `<p>${text}</p>`
  return Array.from({ length: lines }, () => '<p><br></p>').join('')
}

function th(
  content: string,
  attrs: { bgcolor?: string; color?: string; className?: string; colspan?: number; rowspan?: number } = {}
): string {
  const parts = [
    attrs.className ? `class="${attrs.className}"` : '',
    attrs.bgcolor ? `bgcolor="${attrs.bgcolor}"` : '',
    attrs.color ? `style="color:${attrs.color}"` : '',
    attrs.colspan ? `colspan="${attrs.colspan}"` : '',
    attrs.rowspan ? `rowspan="${attrs.rowspan}"` : ''
  ].filter(Boolean)
  return `<th${parts.length ? ` ${parts.join(' ')}` : ''}>${content}</th>`
}

function td(
  content: string,
  attrs: { bgcolor?: string; className?: string; colspan?: number; rowspan?: number } = {}
): string {
  const parts = [
    attrs.className ? `class="${attrs.className}"` : '',
    attrs.bgcolor ? `bgcolor="${attrs.bgcolor}"` : '',
    attrs.colspan ? `colspan="${attrs.colspan}"` : '',
    attrs.rowspan ? `rowspan="${attrs.rowspan}"` : ''
  ].filter(Boolean)
  return `<td${parts.length ? ` ${parts.join(' ')}` : ''}>${content}</td>`
}

function parseTimeHms(value: string): { h: number; m: number } {
  const parts = value.split(':').map((p) => Number.parseInt(p, 10))
  return { h: Number.isFinite(parts[0]) ? parts[0]! : 0, m: Number.isFinite(parts[1]) ? parts[1]! : 0 }
}

function timeSlotLabels(minTime: string, maxTime: string, slotMinutes: number): string[] {
  const start = parseTimeHms(minTime)
  const end = parseTimeHms(maxTime)
  const step = Math.max(15, slotMinutes)
  let cursor = parse(
    `${String(start.h).padStart(2, '0')}:${String(start.m).padStart(2, '0')}`,
    'HH:mm',
    new Date()
  )
  const limit = parse(
    `${String(end.h).padStart(2, '0')}:${String(end.m).padStart(2, '0')}`,
    'HH:mm',
    new Date()
  )
  const labels: string[] = []
  while (cursor < limit) {
    labels.push(format(cursor, 'HH:mm'))
    cursor = addMinutes(cursor, step)
  }
  return labels
}

function orderedWeekdayLabels(
  labels: readonly string[],
  weekStartsOn: 0 | 1
): string[] {
  if (weekStartsOn === 1) return [...labels]
  return [labels[6]!, labels[0]!, labels[1]!, labels[2]!, labels[3]!, labels[4]!, labels[5]!]
}

function weekDays(anchor: Date, weekStartsOn: 0 | 1): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

function dayColumnBg(dayIndex: number, weekStartsOn: 0 | 1): string | undefined {
  const satIndex = weekStartsOn === 1 ? 5 : 6
  const sunIndex = weekStartsOn === 1 ? 6 : 0
  if (dayIndex === satIndex) return PLANNER_COL_SAT_BG
  if (dayIndex === sunIndex) return PLANNER_COL_SUN_BG
  return undefined
}

function dayHeaderBg(dayIndex: number, weekStartsOn: 0 | 1): string {
  const satIndex = weekStartsOn === 1 ? 5 : 6
  const sunIndex = weekStartsOn === 1 ? 6 : 0
  if (dayIndex === satIndex) return PLANNER_HEADER_SAT_BG
  if (dayIndex === sunIndex) return PLANNER_HEADER_SUN_BG
  return PLANNER_HEADER_WEEKDAY_BG
}

const FITNESS_TRACKER_COLUMN_COUNT = 26

export function fitnessMetricColumnLetters(): string[] {
  return Array.from({ length: FITNESS_TRACKER_COLUMN_COUNT }, (_, i) =>
    String.fromCharCode('A'.charCodeAt(0) + i)
  )
}

function weekendRowBg(day: Date): string | undefined {
  const dow = getDay(day)
  if (dow === 6) return PLANNER_COL_SAT_BG
  if (dow === 0) return PLANNER_COL_SUN_BG
  return undefined
}

function scheduleRangeLabel(minTime: string, maxTime: string): string {
  const start = parseTimeHms(minTime)
  const end = parseTimeHms(maxTime)
  return `${String(start.h).padStart(2, '0')}:${String(start.m).padStart(2, '0')} – ${String(end.h).padStart(2, '0')}:${String(end.m).padStart(2, '0')}`
}

export function buildWeeklyPlannerHtml(weekAnchor: Date, opts: NotePlannerBuildOptions): string {
  const days = weekDays(weekAnchor, opts.weekStartsOn)
  const weekdayLabels = orderedWeekdayLabels(opts.labels.weekdaysLong, opts.weekStartsOn)
  const weekNum = getISOWeek(days[0]!)
  const slots = timeSlotLabels(opts.slotMinTime, opts.slotMaxTime, opts.slotMinutes)
  const structuredNoteRows = 3
  const taskRows = 4

  const rows: string[] = []

  rows.push('<tr>')
  rows.push(th('', { bgcolor: PLANNER_KW_BG, className: 'note-planner-label-cell' }))
  for (let i = 0; i < 7; i++) {
    rows.push(
      th(weekdayLabels[i] ?? '', {
        bgcolor: dayHeaderBg(i, opts.weekStartsOn),
        color: '#ffffff',
        className: 'note-planner-day-header'
      })
    )
  }
  rows.push('</tr>')

  rows.push('<tr>')
  rows.push(
    th(`${opts.labels.weekShort} ${weekNum}`, {
      bgcolor: PLANNER_KW_BG,
      className: 'note-planner-kw-cell'
    })
  )
  for (let i = 0; i < 7; i++) {
    rows.push(
      th(format(days[i]!, 'dd', { locale: opts.locale }), {
        bgcolor: PLANNER_DATE_BAR_BG,
        className: 'note-planner-date-cell'
      })
    )
  }
  rows.push('</tr>')

  rows.push('<tr>')
  rows.push(
    td(`<p><strong>${opts.labels.sectionGeneral}</strong></p>`, {
      bgcolor: PLANNER_KW_BG,
      className: 'note-planner-label-cell'
    })
  )
  rows.push(
    td(cellP(4), {
      colspan: 7,
      className: 'note-planner-general-cell'
    })
  )
  rows.push('</tr>')

  rows.push('<tr>')
  rows.push(
    td(`<p><strong>${opts.labels.sectionNotes}</strong></p>`, {
      bgcolor: PLANNER_KW_BG,
      className: 'note-planner-label-cell',
      rowspan: structuredNoteRows
    })
  )
  for (let i = 0; i < 7; i++) {
    rows.push(
      td(cellP(1), {
        bgcolor: dayColumnBg(i, opts.weekStartsOn),
        className: 'note-planner-notes-cell'
      })
    )
  }
  rows.push('</tr>')
  for (let r = 1; r < structuredNoteRows; r++) {
    rows.push('<tr>')
    for (let i = 0; i < 7; i++) {
      rows.push(
        td(cellP(1), {
          bgcolor: dayColumnBg(i, opts.weekStartsOn),
          className: 'note-planner-notes-cell'
        })
      )
    }
    rows.push('</tr>')
  }

  rows.push('<tr>')
  rows.push(
    td(`<p><strong>${opts.labels.sectionTasks}</strong></p>`, {
      bgcolor: PLANNER_KW_BG,
      className: 'note-planner-label-cell',
      rowspan: taskRows
    })
  )
  for (let i = 0; i < 7; i++) {
    rows.push(
      td(TASK_LIST(TASK_ITEM()), {
        bgcolor: dayColumnBg(i, opts.weekStartsOn),
        className: 'note-planner-task-cell'
      })
    )
  }
  rows.push('</tr>')
  for (let r = 1; r < taskRows; r++) {
    rows.push('<tr>')
    for (let i = 0; i < 7; i++) {
      rows.push(
        td(TASK_LIST(TASK_ITEM()), {
          bgcolor: dayColumnBg(i, opts.weekStartsOn),
          className: 'note-planner-task-cell'
        })
      )
    }
    rows.push('</tr>')
  }

  const scheduleLabel = scheduleRangeLabel(opts.slotMinTime, opts.slotMaxTime)
  for (let s = 0; s < slots.length; s++) {
    rows.push('<tr>')
    if (s === 0) {
      rows.push(
        td(`<p><strong>${opts.labels.sectionSchedule}</strong></p><p>${scheduleLabel}</p>`, {
          bgcolor: PLANNER_KW_BG,
          className: 'note-planner-label-cell',
          rowspan: slots.length
        })
      )
    }
    rows.push(
      td(`<p>${slots[s]}</p>`, {
        bgcolor: PLANNER_KW_BG,
        className: 'note-planner-time-cell'
      })
    )
    for (let i = 0; i < 7; i++) {
      rows.push(
        td(cellP(1), {
          bgcolor: dayColumnBg(i, opts.weekStartsOn),
          className: 'note-planner-slot-cell'
        })
      )
    }
    rows.push('</tr>')
  }

  const rangeLabel = `${format(days[0]!, 'dd.MM.', { locale: opts.locale })}–${format(days[6]!, 'dd.MM.yyyy', { locale: opts.locale })}`
  return [
    `<h2>${opts.labels.weekShort} ${weekNum} · ${rangeLabel}</h2>`,
  `<table class="mail-compose-table mail-tbl-bordered note-planner-table note-planner-weekly" data-chronell-planner="weekly"><tbody>${rows.join('')}</tbody></table>`
  ].join('')
}

export function buildMonthlyPlannerHtml(monthAnchor: Date, opts: NotePlannerBuildOptions): string {
  const weekdayLabels = orderedWeekdayLabels(opts.labels.weekdaysLong, opts.weekStartsOn)
  const monthStart = startOfMonth(monthAnchor)
  const monthEnd = endOfMonth(monthAnchor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: opts.weekStartsOn })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: opts.weekStartsOn })
  const weeks = eachWeekOfInterval({ start: gridStart, end: gridEnd }, { weekStartsOn: opts.weekStartsOn })

  const rows: string[] = []

  rows.push('<tr>')
  rows.push(
    th(opts.labels.weekShort, {
      bgcolor: PLANNER_KW_BG,
      className: 'note-planner-kw-cell'
    })
  )
  for (let i = 0; i < 7; i++) {
    rows.push(
      th(weekdayLabels[i] ?? '', {
        bgcolor: dayHeaderBg(i, opts.weekStartsOn),
        color: '#ffffff',
        className: 'note-planner-day-header'
      })
    )
  }
  rows.push('</tr>')

  for (const weekStart of weeks) {
    const days = weekDays(weekStart, opts.weekStartsOn)
    const weekNum = getISOWeek(days[0]!)
    rows.push('<tr>')
    rows.push(
      td(`<p><strong>${opts.labels.weekShort} ${weekNum}</strong></p>`, {
        bgcolor: PLANNER_KW_BG,
        className: 'note-planner-kw-cell'
      })
    )
    for (let i = 0; i < 7; i++) {
      const day = days[i]!
      const inMonth = isSameMonth(day, monthAnchor)
      const dayLabel = format(day, 'dd', { locale: opts.locale })
      rows.push(
        td(
          [
            `<p class="note-planner-day-number"><strong>${dayLabel}</strong></p>`,
            cellP(4)
          ].join(''),
          {
            bgcolor: dayColumnBg(i, opts.weekStartsOn),
            className: inMonth ? 'note-planner-day-cell' : 'note-planner-day-cell note-planner-day-outside'
          }
        )
      )
    }
    rows.push('</tr>')
  }

  const titleMonth = format(monthAnchor, 'LLLL yyyy', { locale: opts.locale })
  return [
    `<h2>${titleMonth}</h2>`,
    `<table class="mail-compose-table mail-tbl-bordered note-planner-table note-planner-monthly" data-chronell-planner="monthly"><tbody>${rows.join('')}</tbody></table>`
  ].join('')
}

export function buildMonthlyFitnessTrackerHtml(monthAnchor: Date, opts: NotePlannerBuildOptions): string {
  const monthStart = startOfMonth(monthAnchor)
  const monthEnd = endOfMonth(monthAnchor)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const metricCols =
    opts.labels.fitnessColumns.length > 0
      ? opts.labels.fitnessColumns
      : fitnessMetricColumnLetters()

  const rows: string[] = []

  rows.push('<tr>')
  rows.push(
    th(opts.labels.weekShort, {
      bgcolor: PLANNER_KW_BG,
      className: 'note-planner-kw-cell note-fitness-kw-header'
    })
  )
  rows.push(
    th(opts.labels.dayColumn, {
      bgcolor: PLANNER_HEADER_WEEKDAY_BG,
      color: '#ffffff',
      className: 'note-fitness-day-header'
    })
  )
  for (const col of metricCols) {
    rows.push(
      th(col, {
        bgcolor: PLANNER_HEADER_WEEKDAY_BG,
        color: '#ffffff',
        className: 'note-fitness-metric-header'
      })
    )
  }
  rows.push('</tr>')

  let prevWeekNum: number | null = null
  for (const day of days) {
    const weekNum = getISOWeek(day)
    const showKw = prevWeekNum !== weekNum
    prevWeekNum = weekNum
    const rowBg = weekendRowBg(day)
    const dayLabel = format(day, 'EEE dd', { locale: opts.locale })

    rows.push('<tr>')
    rows.push(
      td(showKw ? `<p><strong>${opts.labels.weekShort} ${weekNum}</strong></p>` : cellP(1), {
        bgcolor: PLANNER_KW_BG,
        className: 'note-planner-kw-cell note-fitness-kw-cell'
      })
    )
    rows.push(
      td(`<p><strong>${dayLabel}</strong></p>`, {
        bgcolor: rowBg,
        className: 'note-fitness-day-cell'
      })
    )
    for (let c = 0; c < metricCols.length; c++) {
      rows.push(
        td(cellP(1), {
          bgcolor: rowBg,
          className: 'note-fitness-metric-cell'
        })
      )
    }
    rows.push('</tr>')
  }

  const titleMonth = format(monthAnchor, 'LLLL yyyy', { locale: opts.locale })
  const fitnessTitle = `${opts.labels.fitnessTitlePrefix} · ${titleMonth}`
  return [
    `<h2>${fitnessTitle}</h2>`,
    `<table class="mail-compose-table mail-tbl-bordered note-planner-table note-fitness-tracker" data-chronell-planner="fitness-monthly"><tbody>${rows.join('')}</tbody></table>`
  ].join('')
}

export function buildPlannerNoteTitle(
  kind: NotePlannerTemplateKind,
  anchor: Date,
  opts: Pick<NotePlannerBuildOptions, 'weekStartsOn' | 'locale' | 'labels'>
): string {
  if (kind === 'monthlyOverview') {
    return format(anchor, 'LLLL yyyy', { locale: opts.locale })
  }
  if (kind === 'monthlyFitnessTracker') {
    const titleMonth = format(anchor, 'LLLL yyyy', { locale: opts.locale })
    return `${opts.labels.fitnessTitlePrefix} · ${titleMonth}`
  }
  if (kind === 'dailyPlanner') {
    const dayLabel = format(anchor, 'EEEE, dd.MM.yyyy', { locale: opts.locale })
    return `${opts.labels.dailyPlannerTitlePrefix} · ${dayLabel}`
  }
  const days = weekDays(anchor, opts.weekStartsOn)
  const weekNum = getISOWeek(days[0]!)
  const rangeLabel = `${format(days[0]!, 'dd.MM.', { locale: opts.locale })}–${format(days[6]!, 'dd.MM.yyyy', { locale: opts.locale })}`
  return `${opts.labels.weekShort} ${weekNum} · ${rangeLabel}`
}

export function buildPlannerTemplateBody(
  kind: NotePlannerTemplateKind,
  anchor: Date,
  opts: NotePlannerBuildOptions
): string {
  if (kind === 'monthlyOverview') {
    return buildMonthlyPlannerHtml(anchor, opts)
  }
  if (kind === 'monthlyFitnessTracker') {
    return buildMonthlyFitnessTrackerHtml(anchor, opts)
  }
  if (kind === 'dailyPlanner') {
    return buildDailyPlannerHtml(
      anchor,
      dailyPlannerLabelsFromOpts(opts),
      opts.locale,
      opts.slotMinutes,
      opts.slotMinTime,
      opts.slotMaxTime
    )
  }
  return buildWeeklyPlannerHtml(anchor, opts)
}

function dailyPlannerLabelsFromOpts(opts: NotePlannerBuildOptions): DailyPlannerLabels {
  return {
    titlePrefix: opts.labels.dailyPlannerTitlePrefix,
    scheduleDay: opts.labels.dailyScheduleDay,
    scheduleNight: opts.labels.dailyScheduleNight,
    checklist: opts.labels.dailyChecklist,
    priority: opts.labels.dailyPriority,
    action: opts.labels.dailyAction,
    plainList: opts.labels.dailyPlainList,
    gridNotes: opts.labels.dailyGridNotes,
    linedNotes: opts.labels.dailyLinedNotes,
    quadrantNotes: opts.labels.dailyQuadrantNotes
  }
}

export type InstantStructuredTemplateId = 'weeklyTimetable' | 'studentAttendanceList'

export const INSTANT_STRUCTURED_TEMPLATE_IDS = new Set<InstantStructuredTemplateId>([
  'weeklyTimetable',
  'studentAttendanceList'
])

export function isInstantStructuredTemplateId(id: string): id is InstantStructuredTemplateId {
  return INSTANT_STRUCTURED_TEMPLATE_IDS.has(id as InstantStructuredTemplateId)
}

export interface WeeklyTimetableLabels {
  title: string
  weekdays: readonly string[]
}

const DEFAULT_TIMETABLE_PERIOD_COUNT = 10
const TIMETABLE_SLOT_LINES = 4

export function buildWeeklyTimetableHtml(
  labels: WeeklyTimetableLabels,
  periodCount = DEFAULT_TIMETABLE_PERIOD_COUNT
): string {
  const periods = Math.max(1, Math.min(periodCount, 14))
  const rows: string[] = []

  rows.push('<tr>')
  rows.push(
    th('', { bgcolor: PLANNER_KW_BG, className: 'note-timetable-index-header' })
  )
  rows.push(
    th('', { bgcolor: PLANNER_KW_BG, className: 'note-timetable-time-header' })
  )
  for (let i = 0; i < 5; i++) {
    rows.push(
      th(labels.weekdays[i] ?? '', {
        bgcolor: PLANNER_HEADER_WEEKDAY_BG,
        color: '#ffffff',
        className: 'note-timetable-day-header'
      })
    )
  }
  rows.push('</tr>')

  for (let p = 1; p <= periods; p++) {
    rows.push('<tr>')
    rows.push(
      td(`<p><strong>${p}</strong></p>`, {
        bgcolor: PLANNER_KW_BG,
        className: 'note-timetable-index-cell'
      })
    )
    rows.push(
      td(cellP(1), {
        bgcolor: PLANNER_KW_BG,
        className: 'note-timetable-time-cell'
      })
    )
    for (let d = 0; d < 5; d++) {
      rows.push(
        td(cellP(TIMETABLE_SLOT_LINES), {
          className: 'note-timetable-slot-cell'
        })
      )
    }
    rows.push('</tr>')
  }

  return [
    `<h2>${labels.title}</h2>`,
    `<table class="mail-compose-table mail-tbl-bordered note-planner-table note-timetable-table" data-chronell-planner="timetable-weekly"><tbody>${rows.join('')}</tbody></table>`
  ].join('')
}

export interface StudentAttendanceListLabels {
  title: string
  nameColumn: string
  firstNameColumn: string
}

const DEFAULT_ATTENDANCE_STUDENT_ROWS = 25
const DEFAULT_ATTENDANCE_DATE_COLUMNS = 25

export function buildStudentAttendanceListHtml(
  labels: StudentAttendanceListLabels,
  studentRows = DEFAULT_ATTENDANCE_STUDENT_ROWS,
  dateColumns = DEFAULT_ATTENDANCE_DATE_COLUMNS
): string {
  const rows = Math.max(1, Math.min(studentRows, 40))
  const cols = Math.max(1, Math.min(dateColumns, 31))
  const tableRows: string[] = []

  tableRows.push('<tr>')
  tableRows.push(th('', { bgcolor: PLANNER_KW_BG, className: 'note-attendance-index-header' }))
  tableRows.push(
    th(labels.nameColumn, {
      bgcolor: PLANNER_HEADER_WEEKDAY_BG,
      color: '#ffffff',
      className: 'note-attendance-name-header'
    })
  )
  tableRows.push(
    th(labels.firstNameColumn, {
      bgcolor: PLANNER_HEADER_WEEKDAY_BG,
      color: '#ffffff',
      className: 'note-attendance-firstname-header'
    })
  )
  for (let c = 0; c < cols; c++) {
    tableRows.push(
      th(cellP(1), {
        bgcolor: PLANNER_HEADER_WEEKDAY_BG,
        className: 'note-attendance-date-header'
      })
    )
  }
  tableRows.push('</tr>')

  for (let r = 1; r <= rows; r++) {
    tableRows.push('<tr>')
    tableRows.push(
      td(`<p><strong>${r}</strong></p>`, {
        bgcolor: PLANNER_KW_BG,
        className: 'note-attendance-index-cell'
      })
    )
    tableRows.push(td(cellP(1), { className: 'note-attendance-name-cell' }))
    tableRows.push(td(cellP(1), { className: 'note-attendance-firstname-cell' }))
    for (let c = 0; c < cols; c++) {
      tableRows.push(td(cellP(1), { className: 'note-attendance-mark-cell' }))
    }
    tableRows.push('</tr>')
  }

  return [
    `<h2>${labels.title}</h2>`,
    `<table class="mail-compose-table mail-tbl-bordered note-planner-table note-attendance-table" data-chronell-planner="attendance-list"><tbody>${tableRows.join('')}</tbody></table>`
  ].join('')
}

export function buildInstantStructuredTemplateOverride(
  id: InstantStructuredTemplateId,
  translate: (key: string) => string
): { title: string; bodyHtml: string } {
  if (id === 'weeklyTimetable') {
    const title = translate('notes.templates.weeklyTimetable.title')
    const bodyHtml = buildWeeklyTimetableHtml({
      title,
      weekdays: [
        translate('notes.plannerDialog.weekday.mon'),
        translate('notes.plannerDialog.weekday.tue'),
        translate('notes.plannerDialog.weekday.wed'),
        translate('notes.plannerDialog.weekday.thu'),
        translate('notes.plannerDialog.weekday.fri')
      ]
    })
    return { title, bodyHtml }
  }
  if (id === 'studentAttendanceList') {
    const title = translate('notes.templates.studentAttendanceList.title')
    const bodyHtml = buildStudentAttendanceListHtml({
      title,
      nameColumn: translate('notes.attendanceList.nameColumn'),
      firstNameColumn: translate('notes.attendanceList.firstNameColumn')
    })
    return { title, bodyHtml }
  }
  return { title: '', bodyHtml: '' }
}
