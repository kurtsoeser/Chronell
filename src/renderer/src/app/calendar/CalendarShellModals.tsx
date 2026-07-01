import { createPortal } from 'react-dom'
import type { RefObject, Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type FullCalendar from '@fullcalendar/react'
import type { ConnectedAccount, TaskListRow } from '@shared/types'
import { CalendarEventDialog } from '@/app/calendar/CalendarEventDialog'
import { CalendarEventSearchDialog } from '@/app/calendar/CalendarEventSearchDialog'
import {
  CalendarCreateQuickPopover,
  type CalendarCreateQuickDraft
} from '@/app/calendar/CalendarCreateQuickPopover'
import { CalendarShellGotoDateDialog } from '@/app/calendar/CalendarShellGotoDateDialog'
import type { CalendarShellEventDialogState, SetCalendarShellEventDialog } from '@/app/calendar/calendar-shell-event-dialog-state'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { ObjectNoteDialog, type ObjectNoteTarget } from '@/components/ObjectNoteEditor'

export interface CalendarShellModalsProps {
  t: TFunction
  accounts: ConnectedAccount[]
  calendarLinkedAccounts: ConnectedAccount[]
  taskAccounts: ConnectedAccount[]
  eventDialog: CalendarShellEventDialogState
  setEventDialog: SetCalendarShellEventDialog
  quickCreate: {
    anchor: { x: number; y: number }
    range: CalendarCreateRange
  } | null
  dismissQuickCreate: () => void
  handleQuickCreateRangeChange: (range: CalendarCreateRange) => void
  loadTaskListsForAccount: (accountId: string) => Promise<TaskListRow[]>
  onCalendarEventSaved: () => void
  mailNoteTarget: Extract<ObjectNoteTarget, { kind: 'mail' }> | null
  eventNoteTarget: ObjectNoteTarget | null
  setMailNoteTarget: (t: Extract<ObjectNoteTarget, { kind: 'mail' }> | null) => void
  setEventNoteTarget: (t: ObjectNoteTarget | null) => void
  gotoDateOpen: boolean
  setGotoDateOpen: (open: boolean) => void
  gotoDateDraft: string
  setGotoDateDraft: (draft: string) => void
  calendarRef: RefObject<FullCalendar | null>
  setMiniMonth: Dispatch<SetStateAction<Date>>
  calendarEventSearchOpen: boolean
  setCalendarEventSearchOpen: (open: boolean) => void
  calendarEventSearchQuery: string
  setCalendarEventSearchQuery: (q: string) => void
  calendarSearchInputRef: RefObject<HTMLInputElement | null>
}

export function CalendarShellModals({
  t,
  accounts,
  calendarLinkedAccounts,
  taskAccounts,
  eventDialog,
  setEventDialog,
  quickCreate,
  dismissQuickCreate,
  handleQuickCreateRangeChange,
  loadTaskListsForAccount,
  onCalendarEventSaved,
  mailNoteTarget,
  eventNoteTarget,
  setMailNoteTarget,
  setEventNoteTarget,
  gotoDateOpen,
  setGotoDateOpen,
  gotoDateDraft,
  setGotoDateDraft,
  calendarRef,
  setMiniMonth,
  calendarEventSearchOpen,
  setCalendarEventSearchOpen,
  calendarEventSearchQuery,
  setCalendarEventSearchQuery,
  calendarSearchInputRef
}: CalendarShellModalsProps): JSX.Element {
  return (
    <>
      <ObjectNoteDialog
        target={mailNoteTarget ?? eventNoteTarget}
        onClose={(): void => {
          setMailNoteTarget(null)
          setEventNoteTarget(null)
        }}
      />

      {quickCreate &&
        createPortal(
          <CalendarCreateQuickPopover
            anchor={quickCreate.anchor}
            range={quickCreate.range}
            calendarAccounts={calendarLinkedAccounts}
            taskAccounts={taskAccounts}
            defaultAccountId={calendarLinkedAccounts[0]?.id ?? taskAccounts[0]?.id}
            loadListsForAccount={loadTaskListsForAccount}
            onRangeChange={handleQuickCreateRangeChange}
            onClose={dismissQuickCreate}
            onSaved={onCalendarEventSaved}
            onOpenDetails={(draft: CalendarCreateQuickDraft): void => {
              dismissQuickCreate()
              setEventDialog({
                mode: 'create',
                range: draft.range,
                createPrefill: { subject: draft.subject, location: '' },
                createAccountId: draft.accountId,
                createKind: draft.createKind,
                createGraphCalendarId: draft.graphCalendarId || undefined,
                createTaskListId: draft.taskListId || undefined
              })
            }}
          />,
          document.body
        )}

      <CalendarEventDialog
        open={eventDialog != null}
        mode={eventDialog?.mode === 'edit' ? 'edit' : 'create'}
        accounts={accounts}
        defaultAccountId={
          eventDialog?.mode === 'create' && eventDialog.createAccountId
            ? eventDialog.createAccountId
            : calendarLinkedAccounts[0]?.id ?? taskAccounts[0]?.id
        }
        initialRange={
          eventDialog && eventDialog.mode === 'create'
            ? (eventDialog.range ?? undefined)
            : undefined
        }
        createPrefill={
          eventDialog && eventDialog.mode === 'create' && eventDialog.createPrefill
            ? eventDialog.createPrefill
            : undefined
        }
        initialCreateKind={
          eventDialog?.mode === 'create' ? eventDialog.createKind : undefined
        }
        initialGraphCalendarId={
          eventDialog?.mode === 'create' ? eventDialog.createGraphCalendarId : undefined
        }
        initialTaskListId={
          eventDialog?.mode === 'create' ? eventDialog.createTaskListId : undefined
        }
        initialEvent={eventDialog?.mode === 'edit' ? eventDialog.event : null}
        taskAccounts={taskAccounts}
        loadListsForAccount={loadTaskListsForAccount}
        onClose={(): void => setEventDialog(null)}
        onSaved={onCalendarEventSaved}
      />

      <CalendarShellGotoDateDialog
        t={t}
        open={gotoDateOpen}
        draft={gotoDateDraft}
        onDraftChange={setGotoDateDraft}
        onClose={(): void => setGotoDateOpen(false)}
        calendarRef={calendarRef}
        onNavigate={(monthAnchor): void => {
          setMiniMonth(monthAnchor)
        }}
      />

      <CalendarEventSearchDialog
        open={calendarEventSearchOpen}
        query={calendarEventSearchQuery}
        inputRef={calendarSearchInputRef as RefObject<HTMLInputElement>}
        onQueryChange={setCalendarEventSearchQuery}
        onClose={(): void => {
          setCalendarEventSearchOpen(false)
          setCalendarEventSearchQuery('')
        }}
      />
    </>
  )
}
