export type ZoomShortcutScope = 'preview' | 'ui'
export type ZoomShortcutAction = 'in' | 'out' | 'reset'

export interface ZoomShortcutIntent {
  scope: ZoomShortcutScope
  action: ZoomShortcutAction
}

function isZoomInCode(code: string): boolean {
  return code === 'Equal' || code === 'NumpadAdd'
}

function isZoomOutCode(code: string): boolean {
  return code === 'Minus' || code === 'NumpadSubtract'
}

function isZoomResetCode(code: string): boolean {
  return code === 'Digit0' || code === 'Numpad0'
}

/** Strg/Cmd+Plus/Minus/0 (Vorschau) bzw. Strg/Cmd+Umschalt+… (Oberfläche). */
export function parseZoomShortcutIntent(input: {
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  code: string
}): ZoomShortcutIntent | null {
  if (!input.ctrlKey && !input.metaKey) return null
  if (input.altKey) return null

  const scope: ZoomShortcutScope = input.shiftKey ? 'ui' : 'preview'
  const { code } = input

  if (isZoomInCode(code)) return { scope, action: 'in' }
  if (isZoomOutCode(code)) return { scope, action: 'out' }
  if (isZoomResetCode(code)) return { scope, action: 'reset' }

  return null
}

/** Erkennung für Electron before-input-event (Chromium-Zoom unterbinden). */
export function isChromiumZoomShortcutInput(input: {
  control: boolean
  meta: boolean
  key: string
  code: string
}): boolean {
  if (!input.control && !input.meta) return false
  return (
    isZoomInCode(input.code) ||
    isZoomOutCode(input.code) ||
    isZoomResetCode(input.code) ||
    input.key === '=' ||
    input.key === '+' ||
    input.key === '-' ||
    input.key === '0'
  )
}
