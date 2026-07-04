import { describe, expect, it } from 'vitest'
import { de } from 'date-fns/locale/de'
import { buildDailyPlannerHtml } from '@/lib/note-daily-planner-template'

const labels = {
  titlePrefix: 'Tagesplaner',
  scheduleDay: '07:00 – 22:00',
  scheduleNight: '22:00 – 07:00',
  checklist: 'Checkliste',
  priority: 'Prioritäten',
  action: 'Aktionen',
  plainList: 'Liste',
  gridNotes: 'Kästchenpapier',
  linedNotes: 'Liniert',
  quadrantNotes: '4 Felder'
}

describe('note-daily-planner-template', () => {
  it('erzeugt dreispaltigen Tagesplaner', () => {
    const day = new Date(2026, 6, 4)
    const html = buildDailyPlannerHtml(day, labels, de, 30, '07:00:00', '22:00:00')
    expect(html).toContain('data-chronell-planner="daily"')
    expect(html).toContain('note-daily-planner-layout')
    expect(html).toContain('note-daily-col-schedule')
    expect(html).toContain('note-daily-col-tasks')
    expect(html).toContain('note-daily-col-sketch')
    expect(html).toContain('07:00')
    expect(html).toContain('22:00')
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('note-daily-grid-paper')
    expect(html).toContain('note-daily-lined-paper')
    expect(html).toContain('note-daily-quadrant-table')
    expect(html).toMatch(/0[34]\.07\.2026/)
  })
})
