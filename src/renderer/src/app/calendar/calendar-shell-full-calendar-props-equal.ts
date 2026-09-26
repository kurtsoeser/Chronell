import type { CalendarShellFullCalendarProps } from '@/app/calendar/CalendarShellFullCalendar'

/**
 * Nur Props, die die FullCalendar-Optionen wirklich ändern.
 * Callbacks/Setter werden bewusst ignoriert (über Refs im Component gebunden),
 * damit Parent-Re-Renders (Preview, setEvents, …) kein `resetOptions` auslösen.
 */
export function calendarShellFullCalendarPropsAreEqual(
  prev: CalendarShellFullCalendarProps,
  next: CalendarShellFullCalendarProps
): boolean {
  return (
    prev.fcEventSources === next.fcEventSources &&
    prev.fcTimeZone === next.fcTimeZone &&
    prev.i18nLanguage === next.i18nLanguage &&
    prev.timeGridSlotMinutes === next.timeGridSlotMinutes &&
    prev.calSettings === next.calSettings &&
    prev.fcLocale === next.fcLocale &&
    prev.timeGridFcSlotOpts === next.timeGridFcSlotOpts &&
    prev.multiDayViews === next.multiDayViews &&
    prev.dayGridMonthView === next.dayGridMonthView &&
    prev.multiMonthViews === next.multiMonthViews &&
    prev.isMultiMonthActive === next.isMultiMonthActive &&
    prev.calendarLinkedAccounts === next.calendarLinkedAccounts &&
    prev.mailTodoOverlay === next.mailTodoOverlay &&
    prev.cloudTaskOverlay === next.cloudTaskOverlay &&
    prev.userNoteOverlay === next.userNoteOverlay &&
    prev.canInteractInTimeGrid === next.canInteractInTimeGrid &&
    prev.schedulingOpen === next.schedulingOpen &&
    prev.calendarCollatorLocale === next.calendarCollatorLocale &&
    prev.isDeCalendar === next.isDeCalendar &&
    prev.clipboardDfLocale === next.clipboardDfLocale &&
    prev.eventPointerManipulatingRef === next.eventPointerManipulatingRef &&
    prev.graphCalendarReconcilingRef === next.graphCalendarReconcilingRef
  )
}
