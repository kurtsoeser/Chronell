import { describe, expect, it } from 'vitest'
import { de } from 'date-fns/locale/de'
import {
  buildInstantStructuredTemplateOverride,
  buildMonthlyFitnessTrackerHtml,
  buildMonthlyPlannerHtml,
  buildPlannerNoteTitle,
  buildWeeklyPlannerHtml,
  buildWeeklyTimetableHtml,
  buildStudentAttendanceListHtml,
  isInstantStructuredTemplateId,
  isParametricPlannerTemplateId
} from '@/lib/note-planner-templates'

const labels = {
  weekShort: 'KW',
  sectionGeneral: 'Allgemein',
  sectionNotes: 'Notizen',
  sectionTasks: 'Aufgaben',
  sectionSchedule: 'Zeitplan',
  dayColumn: 'Tag',
  fitnessTitlePrefix: 'Fitness',
  fitnessColumns: [] as readonly string[],
  weekdaysLong: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const,
  dailyPlannerTitlePrefix: 'Tagesplaner',
  dailyScheduleDay: '07:00 – 22:00',
  dailyScheduleNight: '22:00 – 07:00',
  dailyChecklist: 'Checkliste',
  dailyPriority: 'Prioritäten',
  dailyAction: 'Aktionen',
  dailyPlainList: 'Liste',
  dailyGridNotes: 'Kästchenpapier',
  dailyLinedNotes: 'Liniert',
  dailyQuadrantNotes: '4 Felder'
}

const opts = {
  weekStartsOn: 1 as const,
  slotMinTime: '07:00:00',
  slotMaxTime: '08:00:00',
  slotMinutes: 30,
  locale: de,
  labels
}

describe('note-planner-templates', () => {
  it('erkennt parametrische Vorlagen-IDs', () => {
    expect(isParametricPlannerTemplateId('weeklyOverview')).toBe(true)
    expect(isParametricPlannerTemplateId('monthlyOverview')).toBe(true)
    expect(isParametricPlannerTemplateId('monthlyFitnessTracker')).toBe(true)
    expect(isParametricPlannerTemplateId('weekly')).toBe(false)
  })

  it('erzeugt Wochenübersicht mit Raster und KW-Titel', () => {
    const anchor = new Date(2026, 6, 6)
    const html = buildWeeklyPlannerHtml(anchor, opts)
    expect(html).toContain('data-chronell-planner="weekly"')
    expect(html).toContain('KW 28')
    expect(html).toContain('Montag')
    expect(html).toContain('Samstag')
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('07:00')
    expect(html).toContain('07:30')
  })

  it('erzeugt Monatsübersicht mit Wochenzeilen', () => {
    const anchor = new Date(2026, 6, 1)
    const html = buildMonthlyPlannerHtml(anchor, opts)
    expect(html).toContain('data-chronell-planner="monthly"')
    expect(html).toContain('Juli 2026')
    expect(html).toContain('note-planner-day-cell')
    expect(html).toMatch(/KW \d+/)
  })

  it('baut Seitentitel für Woche, Monat und Fitness', () => {
    const weekAnchor = new Date(2026, 6, 6)
    expect(buildPlannerNoteTitle('weeklyOverview', weekAnchor, opts)).toMatch(/^KW 28 ·/)
    expect(buildPlannerNoteTitle('monthlyOverview', new Date(2026, 6, 1), opts)).toBe('Juli 2026')
    expect(buildPlannerNoteTitle('monthlyFitnessTracker', new Date(2026, 6, 1), opts)).toBe(
      'Fitness · Juli 2026'
    )
  })

  it('erzeugt Fitness-Tracker mit Tageszeilen und Spalten A–Z', () => {
    const anchor = new Date(2026, 6, 1)
    const html = buildMonthlyFitnessTrackerHtml(anchor, opts)
    expect(html).toContain('data-chronell-planner="fitness-monthly"')
    expect(html).toContain('Fitness · Juli 2026')
    expect(html).toContain('>A</th>')
    expect(html).toContain('>Z</th>')
    expect(html).toContain('note-fitness-metric-cell')
    expect(html).toMatch(/Mi\. 01|Mi 01/)
    expect(html).toMatch(/KW \d+/)
  })

  it('erzeugt Stundenplan Mo–Fr mit 10 Stunden', () => {
    const html = buildWeeklyTimetableHtml({
      title: 'Stundenplan',
      weekdays: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']
    })
    expect(html).toContain('data-chronell-planner="timetable-weekly"')
    expect(html).toContain('Montag')
    expect(html).toContain('Freitag')
    expect(html).not.toContain('Samstag')
    expect(html).toContain('note-timetable-slot-cell')
    expect((html.match(/note-timetable-index-cell/g) ?? []).length).toBe(10)
  })

  it('baut Sofort-Vorlage Stundenplan', () => {
    const t = (key: string): string =>
      key === 'notes.templates.weeklyTimetable.title' ? 'Stundenplan' : key
    expect(isInstantStructuredTemplateId('weeklyTimetable')).toBe(true)
    const result = buildInstantStructuredTemplateOverride('weeklyTimetable', t)
    expect(result.title).toBe('Stundenplan')
    expect(result.bodyHtml).toContain('timetable-weekly')
  })

  it('erzeugt Schülerliste mit Name, Vorname und Anwesenheits-Spalten', () => {
    const html = buildStudentAttendanceListHtml({
      title: 'Schülerliste',
      nameColumn: 'Name',
      firstNameColumn: 'Vorname'
    })
    expect(html).toContain('data-chronell-planner="attendance-list"')
    expect(html).toContain('>Name</th>')
    expect(html).toContain('>Vorname</th>')
    expect(html).toContain('note-attendance-mark-cell')
    expect((html.match(/note-attendance-index-cell/g) ?? []).length).toBe(25)
    expect((html.match(/note-attendance-mark-cell/g) ?? []).length).toBe(25 * 25)
  })

  it('baut Sofort-Vorlage Schülerliste', () => {
    const t = (key: string): string => {
      if (key === 'notes.templates.studentAttendanceList.title') return 'Schülerliste / Anwesenheit'
      if (key === 'notes.attendanceList.nameColumn') return 'Name'
      if (key === 'notes.attendanceList.firstNameColumn') return 'Vorname'
      return key
    }
    expect(isInstantStructuredTemplateId('studentAttendanceList')).toBe(true)
    const result = buildInstantStructuredTemplateOverride('studentAttendanceList', t)
    expect(result.title).toBe('Schülerliste / Anwesenheit')
    expect(result.bodyHtml).toContain('attendance-list')
  })
})
