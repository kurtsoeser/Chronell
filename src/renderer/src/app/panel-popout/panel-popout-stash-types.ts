import type { CalendarEventView } from '@shared/types'
import type { SchedulingSlot } from '@shared/scheduling-types'
import type { ComposeDraft } from '@/stores/compose'

/** Termin-Dialog-Zustand fuer OS-Popout (serialisierbar). */
export type CalendarEventDialogStash =
  | {
      mode: 'create'
      range?: { start: string; end: string; allDay: boolean } | null
      createPrefill?: {
        subject?: string
        location?: string
        attendeeInput?: string
        descriptionHtml?: string
        teamsMeeting?: boolean
      }
      createAccountId?: string
      createKind?: 'event' | 'task'
      createGraphCalendarId?: string
      createTaskListId?: string
    }
  | { mode: 'edit'; event: CalendarEventView }

export type CalendarPreviewPopoutStash =
  | { focus: 'empty' }
  | { focus: 'event'; accountId: string; graphEventId: string }
  | { focus: 'task'; accountId: string; listId: string; taskId: string }
  | { focus: 'mail'; messageId: number }
  | {
      focus: 'scheduling'
      accountId: string
      durationMin: number
      meetingTitle: string
      slots: SchedulingSlot[]
    }

export type ComposePopoutStash = ComposeDraft
