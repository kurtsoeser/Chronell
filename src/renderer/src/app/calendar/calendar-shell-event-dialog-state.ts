import type { CalendarEventView } from '@shared/types'
import type { CalendarCreateQuickDraft } from '@/app/calendar/CalendarCreateQuickPopover'
import type { Dispatch, SetStateAction } from 'react'

export type CalendarShellEventDialogState =
  | null
  | {
      mode: 'create'
      range?: { start: Date; end: Date; allDay: boolean } | null
      createPrefill?: {
        subject?: string
        location?: string
        attendeeInput?: string
        descriptionHtml?: string
        teamsMeeting?: boolean
        webinarMode?: boolean
        /** Cover aus Notion als data:-URL. */
        webinarHeroImageSrc?: string | null
        webinarWebsiteUrl?: string
        /** Beschreibung → Supplement-Block in der Einladung. */
        webinarSupplementHtml?: string
        /** Notion-Seiten-ID (#kurtrocks Events) fuer Link-Writeback. */
        notionPageId?: string
      }
      createAccountId?: string
      createKind?: CalendarCreateQuickDraft['createKind']
      createGraphCalendarId?: string
      createTaskListId?: string
    }
  | { mode: 'edit'; event: CalendarEventView }

export type SetCalendarShellEventDialog = Dispatch<SetStateAction<CalendarShellEventDialogState>>
