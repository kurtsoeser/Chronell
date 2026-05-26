import type { ZoomShortcutIntent } from '@shared/zoom-shortcut-keys'
import { getHoveredMailPreviewZoomHost } from '@/lib/mail-preview-zoom-hover'
import { isComposeEditorFocused } from '@/lib/zoom-focus'
import {
  COMPOSE_EDITOR_SCALE_STEP,
  useComposeEditorScaleStore
} from '@/stores/compose-editor-scale'
import {
  MAIL_PREVIEW_SCALE_STEP,
  useMailPreviewScaleStore
} from '@/stores/mail-preview-scale'
import { UI_SCALE_STEP, useUiScaleStore } from '@/stores/ui-scale'

function applyUiZoom(intent: ZoomShortcutIntent): void {
  const ui = useUiScaleStore.getState()
  if (intent.action === 'in') ui.stepScale(UI_SCALE_STEP)
  else if (intent.action === 'out') ui.stepScale(-UI_SCALE_STEP)
  else ui.resetScale()
}

function applyComposeZoom(intent: ZoomShortcutIntent): void {
  const compose = useComposeEditorScaleStore.getState()
  if (intent.action === 'in') compose.stepScale(COMPOSE_EDITOR_SCALE_STEP)
  else if (intent.action === 'out') compose.stepScale(-COMPOSE_EDITOR_SCALE_STEP)
  else compose.resetScale()
}

function applyMailPreviewZoom(intent: ZoomShortcutIntent): void {
  const preview = useMailPreviewScaleStore.getState()
  if (intent.action === 'in') preview.stepScale(MAIL_PREVIEW_SCALE_STEP)
  else if (intent.action === 'out') preview.stepScale(-MAIL_PREVIEW_SCALE_STEP)
  else preview.resetScale()
}

/**
 * Strg/Cmd+Plus/Minus/0 — eine Oberflächen-Skalierung (Einstellungen + Tastatur).
 * Im Composer: Schriftgröße des Schreibfelds.
 * Über Mail-/Kalender-Vorschau: Inhalts-Zoom (wie Strg+Mausrad).
 * Sonst: gesamte App (#root).
 */
export function applyZoomShortcutIntent(intent: ZoomShortcutIntent): void {
  if (isComposeEditorFocused()) {
    applyComposeZoom(intent)
    return
  }
  if (getHoveredMailPreviewZoomHost()) {
    applyMailPreviewZoom(intent)
    return
  }
  applyUiZoom(intent)
}
