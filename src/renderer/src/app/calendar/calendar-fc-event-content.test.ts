/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { calendarFcEventContent } from './calendar-fc-event-content'

describe('calendarFcEventContent', () => {
  it('platziert Termin-Icon rechts oben (nicht in der Titelzeile)', () => {
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
        view: { type: 'dayGridMonth' }
      } as never,
      { appointment: 'Termin', mail: 'Mail', task: 'Aufgabe', note: 'Notiz' }
    )
    const root = domNodes[0] as HTMLElement
    expect(root.className).toBe('fc-cal-event-custom')
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
      { appointment: 'Termin', mail: 'Mail', task: 'Aufgabe', note: 'Notiz' }
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
      { appointment: 'Termin', mail: 'Mail', task: 'Aufgabe', note: 'Notiz' }
    )
    const root = domNodes[0] as HTMLElement
    const cornerIcon = root.querySelector(':scope > .fc-cal-event-kind-icon')
    expect(cornerIcon?.tagName.toLowerCase()).toBe('svg')
  })
})
