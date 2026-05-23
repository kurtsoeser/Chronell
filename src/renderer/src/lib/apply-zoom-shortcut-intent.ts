import type { ZoomShortcutIntent } from '@shared/zoom-shortcut-keys'
import {
  MAIL_PREVIEW_SCALE_STEP,
  useMailPreviewScaleStore
} from '@/stores/mail-preview-scale'
import { UI_SCALE_STEP, useUiScaleStore } from '@/stores/ui-scale'

export function applyZoomShortcutIntent(intent: ZoomShortcutIntent): void {
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
