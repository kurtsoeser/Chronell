import type { CalendarEventView } from '@shared/types'
import type { CalendarEventDialogStash } from '@/app/panel-popout/panel-popout-stash-types'
import { openPanelPopout, panelPopoutStashKey } from '@/lib/open-panel-popout'
export interface OpenCalendarEventOsPopoutInput {
  mode: 'create' | 'edit'
  initialRange?: { start: Date; end: Date; allDay: boolean } | null
  createPrefill?: {
    subject?: string
    location?: string
    attendeeInput?: string
    descriptionHtml?: string
    teamsMeeting?: boolean
  } | null
  defaultAccountId?: string
  initialCreateKind?: 'event' | 'task'
  initialGraphCalendarId?: string
  initialTaskListId?: string
  initialEvent?: CalendarEventView | null
  title?: string
}

function buildStash(input: OpenCalendarEventOsPopoutInput): CalendarEventDialogStash {
  if (input.mode === 'edit' && input.initialEvent) {
    return { mode: 'edit', event: input.initialEvent }
  }
  return {
    mode: 'create',
    range: input.initialRange
      ? {
          start: input.initialRange.start.toISOString(),
          end: input.initialRange.end.toISOString(),
          allDay: input.initialRange.allDay
        }
      : null,
    createPrefill: input.createPrefill ?? undefined,
    createAccountId: input.defaultAccountId,
    createKind: input.initialCreateKind,
    createGraphCalendarId: input.initialGraphCalendarId,
    createTaskListId: input.initialTaskListId
  }
}

export async function openCalendarEventDialogOsPopout(
  input: OpenCalendarEventOsPopoutInput
): Promise<void> {
  const instanceKey =
    input.mode === 'edit' && input.initialEvent
      ? `${input.initialEvent.accountId}:${input.initialEvent.graphEventId}`
      : `create-${Date.now()}`
  const stashKey = panelPopoutStashKey('calendar-event', instanceKey)
  const title =
    input.title?.trim() ||
    (input.mode === 'edit' ? input.initialEvent?.title?.trim() : undefined) ||
    'Termin'
  await openPanelPopout(
    {
      panel: 'calendar-event',
      instanceKey,
      title,
      stashKey
    },
    buildStash(input)
  )
}
