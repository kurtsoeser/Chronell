const APPOINTMENT_DAYS_KEY = 'mailclient.bookings.appointmentDays.v1'
const DEFAULT_DAYS = 30
const ALLOWED = [7, 14, 30, 60, 90] as const

export type BookingsAppointmentDays = (typeof ALLOWED)[number]

export const BOOKINGS_APPOINTMENT_DAYS_OPTIONS: readonly BookingsAppointmentDays[] = ALLOWED

export const BOOKINGS_APPOINTMENT_DAYS_CHANGED_EVENT =
  'mailclient:bookings-appointment-days-changed'

function notifyChanged(): void {
  window.dispatchEvent(new Event(BOOKINGS_APPOINTMENT_DAYS_CHANGED_EVENT))
}

export function readBookingsAppointmentDays(): BookingsAppointmentDays {
  try {
    const raw = window.localStorage.getItem(APPOINTMENT_DAYS_KEY)
    if (raw == null) return DEFAULT_DAYS
    const n = Number.parseInt(raw, 10)
    if (ALLOWED.includes(n as BookingsAppointmentDays)) return n as BookingsAppointmentDays
    return DEFAULT_DAYS
  } catch {
    return DEFAULT_DAYS
  }
}

export function persistBookingsAppointmentDays(days: BookingsAppointmentDays): void {
  try {
    window.localStorage.setItem(APPOINTMENT_DAYS_KEY, String(days))
  } catch {
    // ignore
  }
  notifyChanged()
}
