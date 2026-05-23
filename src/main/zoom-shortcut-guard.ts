import type { WebContents } from 'electron'
import {
  isChromiumZoomShortcutInput,
  parseZoomShortcutIntent,
  type ZoomShortcutIntent
} from '@shared/zoom-shortcut-keys'

/** Verhindert Chromium-Seitenzoom; Zoom steuert der Renderer (Vorschau / ui-scale). */
export function attachChromiumZoomShortcutGuard(contents: WebContents): void {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    const intent = parseZoomShortcutIntent({
      ctrlKey: input.control,
      metaKey: input.meta,
      altKey: input.alt,
      shiftKey: input.shift,
      code: input.code,
      key: input.key
    })

    if (intent?.scope === 'ui') {
      event.preventDefault()
      contents.send('app:zoom-shortcut', intent satisfies ZoomShortcutIntent)
      return
    }

    if (
      isChromiumZoomShortcutInput({
        control: input.control,
        meta: input.meta,
        shift: input.shift,
        alt: input.alt,
        key: input.key,
        code: input.code
      })
    ) {
      event.preventDefault()
    }
  })
}
