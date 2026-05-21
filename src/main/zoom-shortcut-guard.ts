import type { WebContents } from 'electron'
import { isChromiumZoomShortcutInput } from '@shared/zoom-shortcut-keys'

/** Verhindert Chromium-Seitenzoom; Zoom steuert der Renderer (Vorschau / ui-scale). */
export function attachChromiumZoomShortcutGuard(contents: WebContents): void {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (
      isChromiumZoomShortcutInput({
        control: input.control,
        meta: input.meta,
        key: input.key,
        code: input.code
      })
    ) {
      event.preventDefault()
    }
  })
}
