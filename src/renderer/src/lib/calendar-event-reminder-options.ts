/** Microsoft Graph / Outlook-typische Erinnerungs-Vorlaufzeiten (Minuten vor Beginn). */
export const OUTLOOK_REMINDER_MINUTES_OPTIONS = [
  0, 5, 10, 15, 30, 60, 120, 240, 480, 720, 1440, 2880, 10080
] as const

export function formatOutlookReminderMinutes(
  minutes: number,
  tr: (key: string, options?: Record<string, unknown>) => string
): string {
  if (minutes === 0) return tr('calendar.eventDialog.reminderAtStart')
  if (minutes < 60) return tr('calendar.eventDialog.reminderMinutesBefore', { minutes })
  if (minutes === 60) return tr('calendar.eventDialog.reminderOneHour')
  if (minutes === 120) return tr('calendar.eventDialog.reminderTwoHours')
  if (minutes === 240) return tr('calendar.eventDialog.reminderFourHours')
  if (minutes === 480) return tr('calendar.eventDialog.reminderEightHours')
  if (minutes === 720) return tr('calendar.eventDialog.reminderTwelveHours')
  if (minutes === 1440) return tr('calendar.eventDialog.reminderOneDay')
  if (minutes === 2880) return tr('calendar.eventDialog.reminderTwoDays')
  if (minutes === 10080) return tr('calendar.eventDialog.reminderOneWeek')
  const h = Math.round(minutes / 60)
  return tr('calendar.eventDialog.reminderHoursBefore', { hours: h })
}
