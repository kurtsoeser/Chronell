/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from 'vitest'
import {
  calendarEventDraftFingerprint,
  calendarEventDraftKey,
  clearCalendarEventDraft,
  hasCalendarEventDraftContent,
  readCalendarEventDraft,
  writeCalendarEventDraft,
  type CalendarEventFormDraft
} from './calendar-event-draft-storage'

function baseDraft(
  overrides: Partial<CalendarEventFormDraft> = {}
): Omit<CalendarEventFormDraft, 'updatedAt'> {
  return {
    v: 1,
    key: 'create:event',
    createKind: 'event',
    accountId: 'acc-1',
    graphCalendarId: '',
    subject: '',
    location: '',
    descriptionHtml: '',
    isAllDay: false,
    dayStart: '',
    dayEnd: '',
    dtStart: '2026-08-20T10:00',
    dtEnd: '2026-08-20T11:00',
    eventTimeZone: 'Europe/Berlin',
    secondaryTimeZone: '',
    eventCategories: [],
    reminderEnabled: false,
    reminderMinutesBefore: 15,
    teamsMeeting: false,
    attendeeInput: '',
    recurFreq: 'none',
    recurEnd: 'never',
    recurUntilDate: '',
    recurCount: '10',
    recurWeekdays: [],
    taskAccountId: '',
    taskListId: '',
    taskNotes: '',
    taskDue: '',
    taskPlannedStart: '',
    taskPlannedEnd: '',
    ...overrides
  }
}

describe('calendarEventDraftKey', () => {
  it('unterscheidet create event/task', () => {
    expect(calendarEventDraftKey({ mode: 'create', createKind: 'event' })).toBe('create:event')
    expect(calendarEventDraftKey({ mode: 'create', createKind: 'task' })).toBe('create:task')
  })

  it('bildet edit-Keys aus Konto und Graph-ID', () => {
    expect(
      calendarEventDraftKey({
        mode: 'edit',
        accountId: 'a1',
        graphEventId: 'ev-9'
      })
    ).toBe('edit:a1:ev-9')
  })
})

describe('hasCalendarEventDraftContent', () => {
  it('ist leer ohne inhaltliche Felder', () => {
    expect(hasCalendarEventDraftContent(baseDraft())).toBe(false)
  })

  it('erkennt Titel, Ort, Body und Teilnehmer', () => {
    expect(hasCalendarEventDraftContent(baseDraft({ subject: 'Standup' }))).toBe(true)
    expect(hasCalendarEventDraftContent(baseDraft({ location: 'Büro' }))).toBe(true)
    expect(hasCalendarEventDraftContent(baseDraft({ descriptionHtml: '<p>Hi</p>' }))).toBe(true)
    expect(hasCalendarEventDraftContent(baseDraft({ attendeeInput: 'a@b.com' }))).toBe(true)
  })

  it('ignoriert leeres Editor-HTML', () => {
    expect(hasCalendarEventDraftContent(baseDraft({ descriptionHtml: '<p></p>' }))).toBe(false)
    expect(hasCalendarEventDraftContent(baseDraft({ descriptionHtml: '<p><br></p>' }))).toBe(false)
  })
})

describe('calendarEventDraftFingerprint', () => {
  it('ändert sich bei Feldänderungen', () => {
    const a = calendarEventDraftFingerprint(baseDraft({ subject: 'A' }))
    const b = calendarEventDraftFingerprint(baseDraft({ subject: 'B' }))
    expect(a).not.toBe(b)
  })
})

describe('read/write/clearCalendarEventDraft', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('speichert und liest Entwürfe', () => {
    writeCalendarEventDraft(baseDraft({ subject: 'Planung' }))
    const loaded = readCalendarEventDraft('create:event')
    expect(loaded?.subject).toBe('Planung')
    expect(loaded?.updatedAt).toBeTypeOf('number')
  })

  it('löscht Entwürfe', () => {
    writeCalendarEventDraft(baseDraft({ subject: 'Weg' }))
    clearCalendarEventDraft('create:event')
    expect(readCalendarEventDraft('create:event')).toBeNull()
  })
})
