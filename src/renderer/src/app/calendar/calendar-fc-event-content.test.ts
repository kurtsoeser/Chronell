/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { calendarFcEventContent } from './calendar-fc-event-content'

const labels = {
  appointment: 'Termin',
  mail: 'Mail',
  task: 'Aufgabe',
  note: 'Notiz'
} as const

describe('calendarFcEventContent', () => {
  it('Monatsansicht: Icon links vor dem Titel, Zeit oben als Bereich', () => {
    const { domNodes } = calendarFcEventContent(
      {
        event: {
          id: '1',
          title: 'Workshop',
          allDay: false,
          start: new Date(2026, 5, 20, 9, 30),
          end: new Date(2026, 5, 20, 10, 0),
          extendedProps: {
            calendarEvent: { icon: 'car' }
          }
        },
        timeText: '09 Uhr',
        isMirror: false,
        view: { type: 'dayGridMonth' }
      } as never,
      labels
    )
    const root = domNodes[0] as HTMLElement
    expect(root.classList.contains('fc-cal-event-custom--month')).toBe(true)
    const time = root.querySelector('.fc-cal-event-custom-time')
    expect(time?.textContent).toBe('09:30 - 10:00')
    const titleRow = root.querySelector('.fc-cal-event-custom-title-row')
    expect(titleRow).not.toBeNull()
    const inlineIcon = titleRow?.querySelector('.fc-cal-event-kind-icon--inline')
    expect(inlineIcon).not.toBeNull()
    expect(root.querySelector(':scope > .fc-cal-event-kind-icon')).toBeNull()
  })

  it('Zeitachse: Termin-Icon rechts oben (nicht in der Titelzeile)', () => {
    const { domNodes } = calendarFcEventContent(
      {
        event: {
          id: '1',
          title: 'Workshop',
          extendedProps: {
            calendarEvent: { icon: 'car' }
          }
        },
        timeText: '09 Uhr',
        isMirror: false,
        view: { type: 'timeGridWeek' }
      } as never,
      labels
    )
    const root = domNodes[0] as HTMLElement
    expect(root.querySelector('.fc-cal-event-custom-title-row')).toBeNull()
    const cornerIcon = root.querySelector(':scope > .fc-cal-event-kind-icon')
    expect(cornerIcon).not.toBeNull()
    expect(root.querySelector('.fc-cal-event-custom-body .fc-cal-event-kind-icon')).toBeNull()
  })

  it('streicht erledigte Cloud-Aufgaben im Titel durch', () => {
    const { domNodes } = calendarFcEventContent(
      {
        event: {
          id: 'task-1',
          title: 'Workshop vorbereiten',
          extendedProps: {
            calendarKind: 'cloudTask',
            cloudTask: { completed: true, iconId: null, iconColor: null }
          }
        },
        timeText: '',
        isMirror: false,
        view: { type: 'dayGridMonth' }
      } as never,
      labels
    )
    const root = domNodes[0] as HTMLElement
    expect(root.classList.contains('fc-cal-event-custom--completed')).toBe(true)
    const title = root.querySelector('.fc-cal-event-custom-title')
    expect(title?.classList.contains('fc-cal-event-custom-title--completed')).toBe(true)
  })

  it('zeigt Standard-Kalender-Icon ohne explizites Termin-Icon', () => {
    const { domNodes } = calendarFcEventContent(
      {
        event: {
          id: '2',
          title: 'Meeting',
          extendedProps: {}
        },
        timeText: '10:00',
        isMirror: false,
        view: { type: 'dayGridMonth' }
      } as never,
      labels
    )
    const root = domNodes[0] as HTMLElement
    const inlineIcon = root.querySelector('.fc-cal-event-kind-icon--inline')
    expect(inlineIcon?.tagName.toLowerCase()).toBe('svg')
  })
})
