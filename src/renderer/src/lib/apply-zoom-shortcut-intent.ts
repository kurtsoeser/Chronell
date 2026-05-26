import type { ZoomShortcutIntent } from '@shared/zoom-shortcut-keys'
import {
  COMPOSE_EDITOR_SCALE_STEP,
  useComposeEditorScaleStore
} from '@/stores/compose-editor-scale'
import { UI_SCALE_STEP, useUiScaleStore } from '@/stores/ui-scale'
import { isComposeEditorFocused } from '@/lib/zoom-focus'

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

/**
 * Strg/Cmd+Plus/Minus/0 — eine Oberflächen-Skalierung (Einstellungen + Tastatur).
 * Im Composer: Schriftgröße des Schreibfelds; sonst: gesamte App (#root).
 */
export function applyZoomShortcutIntent(intent: ZoomShortcutIntent): void {
  if (isComposeEditorFocused()) {
    applyComposeZoom(intent)
    return
  }
  applyUiZoom(intent)
}
