import { useEffect } from 'react'
import { parseZoomShortcutIntentFromKeyboardEvent } from '@/lib/zoom-shortcut-keys'
import {
  MAIL_PREVIEW_SCALE_STEP,
  useMailPreviewScaleStore
} from '@/stores/mail-preview-scale'
import { UI_SCALE_STEP, useUiScaleStore } from '@/stores/ui-scale'

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
    const onKeyDown = (e: KeyboardEvent): void => {
      const intent = parseZoomShortcutIntentFromKeyboardEvent(e)
      if (!intent) return
      if (isEditableTarget(e.target)) return

      e.preventDefault()
      e.stopPropagation()

      if (intent.scope === 'ui') {
        const ui = useUiScaleStore.getState()
        if (intent.action === 'in') ui.stepScale(UI_SCALE_STEP)
        else if (intent.action === 'out') ui.stepScale(-UI_SCALE_STEP)
        else ui.resetScale()
        return
      }

      const preview = useMailPreviewScaleStore.getState()
      if (intent.action === 'in') preview.stepScale(MAIL_PREVIEW_SCALE_STEP)
      else if (intent.action === 'out') preview.stepScale(-MAIL_PREVIEW_SCALE_STEP)
      else preview.resetScale()
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return (): void => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])
}
