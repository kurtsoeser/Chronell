import { useEffect } from 'react'
import type { ZoomShortcutIntent } from '@shared/zoom-shortcut-keys'
import { applyZoomShortcutIntent } from '@/lib/apply-zoom-shortcut-intent'
import { parseZoomShortcutIntentFromKeyboardEvent } from '@/lib/zoom-shortcut-keys'

/**
 * Strg/Cmd + Plus/Minus/0 — Oberflächengröße (gleicher Store wie Einstellungen).
 * Im Composer: Schriftgröße des Schreibfelds. Über Mail-/Kalender-Vorschau: Inhalts-Zoom.
 */
export function useZoomShortcuts(): void {
  useEffect(() => {
    const onIntent = (intent: ZoomShortcutIntent): void => {
      applyZoomShortcutIntent(intent)
    }

    const offMain = window.mailClient?.events?.onZoomShortcut?.(onIntent)
    const useMainChannel = typeof window.mailClient?.events?.onZoomShortcut === 'function'

    const onKeyDown = (e: KeyboardEvent): void => {
      const intent = parseZoomShortcutIntentFromKeyboardEvent(e)
      if (!intent) return
      e.preventDefault()
      e.stopPropagation()
      onIntent(intent)
    }

    if (!useMainChannel) {
      window.addEventListener('keydown', onKeyDown, { capture: true })
    }

    return (): void => {
      if (!useMainChannel) {
        window.removeEventListener('keydown', onKeyDown, { capture: true })
      }
      offMain?.()
    }
  }, [])
}
