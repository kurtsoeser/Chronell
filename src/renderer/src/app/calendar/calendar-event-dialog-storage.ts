export type CalendarEventDialogPlacement = 'modal' | 'float' | 'dock'

const PLACEMENT_KEY = 'mailclient.calendar.eventDialog.placement'
const MODAL_SIZE_KEY = 'mailclient.calendar.eventDialog.modalSize'
const DOCK_WIDTH_KEY = 'mailclient.calendar.eventDialog.dockWidth'
export const CAL_EVENT_DIALOG_FLOAT_SIZE_KEY = 'mailclient.calendar.eventDialog.floatSize'

export const CAL_EVENT_DIALOG_DEFAULT_MODAL_W = 1040
export const CAL_EVENT_DIALOG_DEFAULT_MODAL_H = 720
export const CAL_EVENT_DIALOG_DEFAULT_DOCK_W = 680
export const CAL_EVENT_DIALOG_DAY_COLUMN_WIDTH_KEY = 'mailclient.calendar.eventDialog.dayColumnWidth'
export const CAL_EVENT_DIALOG_DEFAULT_DAY_COLUMN_W = 260

export function readCalendarEventDialogPlacement(): CalendarEventDialogPlacement {
  try {
    const v = window.localStorage.getItem(PLACEMENT_KEY)
    if (v === 'float' || v === 'dock' || v === 'modal') return v
  } catch {
    // ignore
  }
  return 'modal'
}

export function persistCalendarEventDialogPlacement(placement: CalendarEventDialogPlacement): void {
  try {
    window.localStorage.setItem(PLACEMENT_KEY, placement)
  } catch {
    // ignore
  }
}

export function readCalendarEventDialogModalSize(): { w: number; h: number } {
  try {
    const raw = window.localStorage.getItem(MODAL_SIZE_KEY)
    if (!raw) return { w: CAL_EVENT_DIALOG_DEFAULT_MODAL_W, h: CAL_EVENT_DIALOG_DEFAULT_MODAL_H }
    const o = JSON.parse(raw) as { w?: unknown; h?: unknown }
    const w = typeof o.w === 'number' && Number.isFinite(o.w) ? o.w : CAL_EVENT_DIALOG_DEFAULT_MODAL_W
    const h = typeof o.h === 'number' && Number.isFinite(o.h) ? o.h : CAL_EVENT_DIALOG_DEFAULT_MODAL_H
    return { w, h }
  } catch {
    return { w: CAL_EVENT_DIALOG_DEFAULT_MODAL_W, h: CAL_EVENT_DIALOG_DEFAULT_MODAL_H }
  }
}

export function persistCalendarEventDialogModalSize(w: number, h: number): void {
  try {
    window.localStorage.setItem(MODAL_SIZE_KEY, JSON.stringify({ w: Math.round(w), h: Math.round(h) }))
  } catch {
    // ignore
  }
}

export function readCalendarEventDialogDockWidth(): number {
  try {
    const raw = window.localStorage.getItem(DOCK_WIDTH_KEY)
    const n = raw ? Number(raw) : NaN
    if (Number.isFinite(n)) return Math.min(900, Math.max(360, Math.round(n)))
  } catch {
    // ignore
  }
  return CAL_EVENT_DIALOG_DEFAULT_DOCK_W
}

export function persistCalendarEventDialogDockWidth(w: number): void {
  try {
    window.localStorage.setItem(DOCK_WIDTH_KEY, String(Math.round(w)))
  } catch {
    // ignore
  }
}
