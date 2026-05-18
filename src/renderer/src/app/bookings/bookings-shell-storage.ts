export type BookingsPreviewPlacement = 'dock' | 'float'

export const BOOKINGS_PREVIEW_OPEN_KEY = 'mailclient.bookingsShell.previewOpen'
export const BOOKINGS_PREVIEW_PLACEMENT_KEY = 'mailclient.bookingsShell.previewPlacement'
export const BOOKINGS_PREVIEW_WIDTH_KEY = 'mailclient.bookingsShell.previewWidth'
export const BOOKINGS_FLOAT_PREVIEW_SIZE_KEY = 'mailclient.bookingsShell.floatPreviewSize'

const DEFAULT_PREVIEW_WIDTH = 360

export function readBookingsPreviewOpen(): boolean {
  try {
    const v = window.localStorage.getItem(BOOKINGS_PREVIEW_OPEN_KEY)
    if (v == null) return true
    return v === '1'
  } catch {
    return true
  }
}

export function persistBookingsPreviewOpen(open: boolean): void {
  try {
    window.localStorage.setItem(BOOKINGS_PREVIEW_OPEN_KEY, open ? '1' : '0')
  } catch {
    // ignore
  }
}

export function readBookingsPreviewPlacement(): BookingsPreviewPlacement {
  try {
    const v = window.localStorage.getItem(BOOKINGS_PREVIEW_PLACEMENT_KEY)
    return v === 'float' ? 'float' : 'dock'
  } catch {
    return 'dock'
  }
}

export function persistBookingsPreviewPlacement(placement: BookingsPreviewPlacement): void {
  try {
    window.localStorage.setItem(BOOKINGS_PREVIEW_PLACEMENT_KEY, placement)
  } catch {
    // ignore
  }
}

export function readBookingsPreviewWidth(): number {
  try {
    const raw = window.localStorage.getItem(BOOKINGS_PREVIEW_WIDTH_KEY)
    if (raw == null) return DEFAULT_PREVIEW_WIDTH
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return DEFAULT_PREVIEW_WIDTH
    return Math.min(560, Math.max(280, n))
  } catch {
    return DEFAULT_PREVIEW_WIDTH
  }
}

export function persistBookingsPreviewWidth(px: number): void {
  try {
    window.localStorage.setItem(BOOKINGS_PREVIEW_WIDTH_KEY, String(Math.round(px)))
  } catch {
    // ignore
  }
}
