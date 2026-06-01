import type { MailFull } from '@shared/types'
import { useMailReplyWithMeetingStore } from '@/stores/mail-reply-with-meeting'

/** Termin-Editor mit Teilnehmern aus der Mail oeffnen («Mit Besprechung antworten»). */
export function openReplyWithMeetingFromMail(message: MailFull): void {
  useMailReplyWithMeetingStore.getState().openFromMessage(message)
}
