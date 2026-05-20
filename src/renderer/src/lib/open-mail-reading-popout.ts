import { useMailStore } from '@/stores/mail'
import { useMailReadingPopoutStore } from '@/stores/mail-reading-popout'

/** Auswahl + Lesefenster-Pop-up (wie Hover-Aktion «Als Pop-up öffnen»). */
export function openMailReadingPopout(
  messageId: number,
  opts?: { osWindow?: boolean }
): void {
  void useMailStore.getState().selectMessageWithThreadPreview(messageId)
  useMailReadingPopoutStore.getState().openForMessage(messageId, opts)
}
