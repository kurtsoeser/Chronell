import { parseZoomShortcutIntent } from '@shared/zoom-shortcut-keys'

export {
  isAppZoomShortcutInput,
  isChromiumZoomShortcutInput,
  parseZoomShortcutIntent,
  type ZoomShortcutAction,
  type ZoomShortcutIntent,
  type ZoomShortcutScope
} from '@shared/zoom-shortcut-keys'

export function parseZoomShortcutIntentFromKeyboardEvent(e: KeyboardEvent) {
  return parseZoomShortcutIntent({
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    code: e.code,
    key: e.key
  })
}
