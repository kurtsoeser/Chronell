const STORAGE_KEY = 'mailclient:calendar-scheduling-draft-v1'

/** Entfernt gespeicherte Terminplanungs-Entwürfe (Legacy aus früheren Versionen). */
export function clearSchedulingDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
