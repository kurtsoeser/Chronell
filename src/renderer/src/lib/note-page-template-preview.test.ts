import { describe, expect, it } from 'vitest'
import { de } from 'date-fns/locale/de'
import {
  buildNotePageTemplatePreviewHtml,
  notePageTemplatePreviewScale
} from '@/lib/note-page-template-preview'

const plannerOptions = {
  weekStartsOn: 1 as const,
  slotMinTime: '07:00:00',
  slotMaxTime: '22:00:00',
  slotMinutes: 30,
  locale: de,
  labels: {
    weekShort: 'KW',
    sectionGeneral: 'Allgemein',
    sectionNotes: 'Notizen',
    sectionTasks: 'Aufgaben',
    sectionSchedule: 'Zeitplan',
    dayColumn: 'Tag',
    fitnessTitlePrefix: 'Fitness',
    fitnessColumns: [] as readonly string[],
    weekdaysLong: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    dailyPlannerTitlePrefix: 'Tagesplaner',
    dailyScheduleDay: '07:00 – 22:00',
    dailyScheduleNight: '22:00 – 07:00',
    dailyChecklist: 'Checkliste',
    dailyPriority: 'Prioritäten',
    dailyAction: 'Aktionen',
    dailyPlainList: 'Liste',
    dailyGridNotes: 'Kästchen',
    dailyLinedNotes: 'Liniert',
    dailyQuadrantNotes: '4 Felder'
  }
}

describe('note-page-template-preview', () => {
  it('liefert keine Vorschau für leere Seite', () => {
    expect(buildNotePageTemplatePreviewHtml('blank', [], (k) => k, plannerOptions)).toBeNull()
  })

  it('liefert HTML für Meeting-Vorlage', () => {
    const html = buildNotePageTemplatePreviewHtml('meeting', [], (k) => k, plannerOptions)
    expect(html).toContain('<h2>Meeting</h2>')
  })

  it('liefert HTML für parametrische Planer-Vorlage', () => {
    const html = buildNotePageTemplatePreviewHtml('dailyPlanner', [], (k) => k, plannerOptions)
    expect(html).toContain('note-daily-planner-layout')
  })

  it('skaliert breite Vorlagen stärker herunter', () => {
    expect(notePageTemplatePreviewScale('monthlyFitnessTracker')).toBeLessThan(
      notePageTemplatePreviewScale('meeting')
    )
  })
})
