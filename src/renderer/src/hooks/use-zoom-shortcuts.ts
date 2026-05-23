import { useEffect } from 'react'
import type { ZoomShortcutIntent } from '@shared/zoom-shortcut-keys'
import { applyZoomShortcutIntent } from '@/lib/apply-zoom-shortcut-intent'
import { parseZoomShortcutIntentFromKeyboardEvent } from '@/lib/zoom-shortcut-keys'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('input, textarea, select, [contenteditable="true"]')
}

/**
 * Globale Zoom-Tasten:
 * - Strg/Cmd + Plus/Minus/0 → Mail-Vorschau
 * - Strg/Cmd + Umschalt + Plus/Minus/0 → Oberflächengröße (ui-scale)
 */
export function useZoomShortcuts(): void {
  useEffect(() => {
    const onIntent = (intent: ZoomShortcutIntent): void => {
      applyZoomShortcutIntent(intent)
    }

    const offMain = window.mailClient?.events?.onZoomShortcut?.(onIntent)

    const onKeyDown = (e: KeyboardEvent): void => {
      const intent = parseZoomShortcutIntentFromKeyboardEvent(e)
      if (!intent) return
      if (isEditableTarget(e.target)) return

      e.preventDefault()
      e.stopPropagation()
      onIntent(intent)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return (): void => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      offMain?.()
    }
  }, [])
}
