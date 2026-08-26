export type MailCalendarSidebarViewMode = 'day' | 'week' | 'month'

export const MAIL_CALENDAR_SIDEBAR_VIEW_MODE_KEY = 'mailclient.mailRightSidebar.viewMode'

export function readMailCalendarSidebarViewMode(): MailCalendarSidebarViewMode {
  try {
    const v = window.localStorage.getItem(MAIL_CALENDAR_SIDEBAR_VIEW_MODE_KEY)
    if (v === 'week' || v === 'month') return v
  } catch {
    // ignore
  }
  return 'day'
}

export function writeMailCalendarSidebarViewMode(mode: MailCalendarSidebarViewMode): void {
  try {
    window.localStorage.setItem(MAIL_CALENDAR_SIDEBAR_VIEW_MODE_KEY, mode)
  } catch {
    // ignore
  }
}
