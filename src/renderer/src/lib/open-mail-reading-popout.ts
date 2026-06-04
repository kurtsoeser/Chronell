import { loadUseOsFloatingPanelsDefault } from '@/lib/floating-panels-prefs'
import { useMailStore } from '@/stores/mail'
import { useMailReadingPopoutStore } from '@/stores/mail-reading-popout'

export type MailReadingPopoutOpenOpts = {
  /** Eigenes Fenster auf dem Bildschirm (Standard aus Einstellungen). */
  osWindow?: boolean
  /** Schwebendes Panel nur innerhalb der Chronell-Hauptansicht. */
  inAppFloat?: boolean
}

export function resolveMailReadingPopoutUseOsWindow(
  opts?: MailReadingPopoutOpenOpts
): boolean {
  if (opts?.inAppFloat) return false
  if (opts?.osWindow === true) return true
  if (opts?.osWindow === false) return false
  return loadUseOsFloatingPanelsDefault()
}

/** Umschalt+Klick: In-App-Panel; normal: OS-Fenster wenn in den Einstellungen aktiv. */
export function mailReadingPopoutOptsFromClick(e: { shiftKey: boolean }): MailReadingPopoutOpenOpts {
  return e.shiftKey ? { inAppFloat: true } : {}
}

/** Auswahl + Lesefenster-Pop-up (wie Hover-Aktion «Als Pop-up öffnen»). */
export function openMailReadingPopout(
  messageId: number,
  opts?: MailReadingPopoutOpenOpts
): void {
  void useMailStore.getState().selectMessageWithThreadPreview(messageId)
  useMailReadingPopoutStore.getState().openForMessage(messageId, opts)
}
