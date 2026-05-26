import type { WebContents } from 'electron'
import { isAppZoomShortcutInput, parseZoomShortcutIntent, type ZoomShortcutIntent } from '@shared/zoom-shortcut-keys'

/** Verhindert Chromium-Seitenzoom; Oberflächengröße steuert der Renderer (ui-scale). */
export function attachChromiumZoomShortcutGuard(contents: WebContents): void {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    if (
      !isAppZoomShortcutInput({
        control: input.control,
        meta: input.meta,
        shift: input.shift,
        alt: input.alt,
        key: input.key,
        code: input.code
      })
    ) {
      return
    }

    const intent = parseZoomShortcutIntent({
      ctrlKey: input.control,
      metaKey: input.meta,
      altKey: input.alt,
      shiftKey: input.shift,
      code: input.code,
      key: input.key
    })
    if (!intent) return

    event.preventDefault()
    contents.send('app:zoom-shortcut', intent satisfies ZoomShortcutIntent)
  })
}
