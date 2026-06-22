import type { MailFull } from '@shared/types'
import { useMailScheduleMeetingStore } from '@/stores/mail-schedule-meeting'

/** Termin aus Mail planen (Kalender-Slot wählen + Einladung senden). */
export function openScheduleMeetingFromMail(message: MailFull): void {
  useMailScheduleMeetingStore.getState().openFromMessage(message)
}
