import type { CalendarApi } from '@fullcalendar/core'

const WIDTH_SELECTOR =
  '.fc-scrollgrid table, .fc-scrollgrid-sticky-shim, .fc-timegrid-body, .fc-timegrid-slots table'

/** Inline-Breiten zuruecksetzen, damit FC die Containerbreite neu messen kann. */
function resetInlineWidths(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(WIDTH_SELECTOR).forEach((el) => {
    el.style.removeProperty('width')
    el.style.removeProperty('min-width')
  })
}

/**
 * FullCalendar v6 (v. a. timeGridWeek) setzt feste Pixel-Breiten als inline style
 * (.fc-timegrid-body, Scrollgrid-Tabellen). Nach Layout-Aenderungen bleibt die alte
 * Breite haengen — der Kalender fuellt dann nicht mehr die Spalte.
 */
export function syncFullCalendarWidth(
  root: HTMLElement | null,
  api: CalendarApi | null | undefined
): void {
  if (!root || !api) return
  resetInlineWidths(root)
  void root.offsetWidth
  api.updateSize()
  requestAnimationFrame(() => {
    resetInlineWidths(root)
    void root.offsetWidth
    api.updateSize()
  })
}
