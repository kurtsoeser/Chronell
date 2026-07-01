import type { CalendarEventView } from '@shared/types'
import type { CalendarCreateQuickDraft } from '@/app/calendar/CalendarCreateQuickPopover'
import type { Dispatch, SetStateAction } from 'react'

export type CalendarShellEventDialogState =
  | null
  | {
      mode: 'create'
      range?: { start: Date; end: Date; allDay: boolean } | null
      createPrefill?: { subject: string; location: string }
      createAccountId?: string
      createKind?: CalendarCreateQuickDraft['createKind']
      createGraphCalendarId?: string
      createTaskListId?: string
    }
  | { mode: 'edit'; event: CalendarEventView }

export type SetCalendarShellEventDialog = Dispatch<SetStateAction<CalendarShellEventDialogState>>
