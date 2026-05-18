import { afterEach, describe, expect, it, vi } from 'vitest'
import { CALENDAR_KIND_MAIL_TODO } from '@/app/calendar/mail-todo-calendar'
import {
  removeCloudTaskCalendarEventsByTaskKey,
  removeDuplicateFullCalendarEventsById,
  removeMailTodoCalendarEventsByMessageId,
  scheduleRemoveDuplicateFullCalendarEventsById
} from '@/app/calendar/calendar-fc-event-source'

describe('removeDuplicateFullCalendarEventsById', () => {
  it('entfernt Duplikate mit gleicher id, behält das erste', () => {
    const first = { id: 'ev-1', allDay: false, remove: vi.fn() }
    const second = { id: 'ev-1', allDay: false, remove: vi.fn() }
    const third = { id: 'ev-2', allDay: false, remove: vi.fn() }
    const api = {
      getEvents: () => [first, second, third]
    }
    removeDuplicateFullCalendarEventsById(api as never, ['ev-1', 'ev-2'])
    expect(first.remove).not.toHaveBeenCalled()
    expect(second.remove).toHaveBeenCalledOnce()
    expect(third.remove).not.toHaveBeenCalled()
  })

  it('bevorzugt zeitgebundenes Event gegenüber Ganztag bei gleicher id', () => {
    const allDay = { id: 'mail-todo:1', allDay: true, remove: vi.fn() }
    const timed = { id: 'mail-todo:1', allDay: false, remove: vi.fn() }
    const api = { getEvents: () => [allDay, timed] }
    removeDuplicateFullCalendarEventsById(api as never, ['mail-todo:1'])
    expect(allDay.remove).toHaveBeenCalledOnce()
    expect(timed.remove).not.toHaveBeenCalled()
  })
})

describe('removeMailTodoCalendarEventsByMessageId', () => {
  it('entfernt alle Mail-ToDo-Events einer Message ausser keepEventId', () => {
    const staleAllDay = {
      id: 'mail-todo:99',
      allDay: true,
      extendedProps: {
        calendarKind: CALENDAR_KIND_MAIL_TODO,
        mailMessage: { id: 7 }
      },
      remove: vi.fn()
    }
    const timed = {
      id: 'mail-todo:99',
      allDay: false,
      extendedProps: {
        calendarKind: CALENDAR_KIND_MAIL_TODO,
        mailMessage: { id: 7 }
      },
      remove: vi.fn()
    }
    const other = {
      id: 'mail-todo:100',
      allDay: false,
      extendedProps: {
        calendarKind: CALENDAR_KIND_MAIL_TODO,
        mailMessage: { id: 8 }
      },
      remove: vi.fn()
    }
    const api = { getEvents: () => [staleAllDay, timed, other] }
    removeMailTodoCalendarEventsByMessageId(api as never, 7, 'mail-todo:99')
    expect(staleAllDay.remove).toHaveBeenCalledOnce()
    expect(timed.remove).not.toHaveBeenCalled()
    expect(other.remove).not.toHaveBeenCalled()
  })
})

describe('scheduleRemoveDuplicateFullCalendarEventsById', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('plant Entfernung nach zwei Animation Frames', () => {
    const rafImpl = (cb: FrameRequestCallback): number => {
      cb(0)
      return 0
    }
    globalThis.requestAnimationFrame = rafImpl
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(rafImpl)
    const api = { getEvents: () => [] as { id: string; remove: () => void }[] }
    scheduleRemoveDuplicateFullCalendarEventsById(api as never, ['ev-1'])
    expect(raf).toHaveBeenCalledTimes(2)
  })
})
