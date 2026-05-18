import type { EventInput } from '@fullcalendar/core'
import type { SchedulingSlot } from '@shared/scheduling-types'
import { schedulingPlaceholderEventId } from '@shared/scheduling-types'

export function schedulingSlotsToFcEvents(slots: SchedulingSlot[]): EventInput[] {
  return slots.map((slot) => ({
    id: schedulingPlaceholderEventId(slot.id),
    start: slot.startIso,
    end: slot.endIso,
    allDay: slot.isAllDay,
    title: '',
    classNames: ['fc-scheduling-slot-placeholder'],
    editable: false,
    startEditable: false,
    durationEditable: false,
    resourceEditable: false,
    overlap: true,
    display: slot.isAllDay ? 'background' : undefined,
    backgroundColor: 'transparent',
    borderColor: 'transparent'
  }))
}
