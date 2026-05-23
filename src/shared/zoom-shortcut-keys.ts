export type ZoomShortcutScope = 'preview' | 'ui'
export type ZoomShortcutAction = 'in' | 'out' | 'reset'

export interface ZoomShortcutIntent {
  scope: ZoomShortcutScope
  action: ZoomShortcutAction
}

/** US-Minus-Taste ({@code -_}); auf DE-QWERTZ liegt „-“ auf {@link isZoomOutSlashCode}. */
function isZoomOutMinusCode(code: string): boolean {
  return code === 'Minus' || code === 'NumpadSubtract'
}

/** DE/ISO: Taste mit „-“ und „_“ (US-Position {@code /?}). */
function isZoomOutSlashCode(code: string): boolean {
  return code === 'Slash'
}

function isZoomOutCode(code: string): boolean {
  return isZoomOutMinusCode(code) || isZoomOutSlashCode(code)
}

function isZoomOutKey(key: string): boolean {
  return key === '-' || key === '_'
}

/** US-Plus-Taste ({@code =+}); auf DE-QWERTZ liegt „+“ oft auf {@link isZoomInBracketCode}. */
function isZoomInEqualCode(code: string): boolean {
  return code === 'Equal' || code === 'NumpadAdd'
}

/** DE/ISO: Taste mit „+“ und „*“ (US-Position {@code ]}). */
function isZoomInBracketCode(code: string): boolean {
  return code === 'BracketRight' || code === 'IntlRo'
}

function isZoomInCode(code: string): boolean {
  return isZoomInEqualCode(code) || isZoomInBracketCode(code)
}

function isZoomInKey(key: string): boolean {
  return key === '+' || key === '=' || key === '*'
}

function isZoomResetCode(code: string): boolean {
  return code === 'Digit0' || code === 'Numpad0'
}

function isZoomResetKey(key: string): boolean {
  return key === '0'
}

function matchesZoomIn(code: string, key?: string): boolean {
  if (isZoomInCode(code)) return true
  return key != null && isZoomInKey(key)
}

function matchesZoomOut(code: string, key?: string): boolean {
  if (isZoomOutCode(code)) return true
  return key != null && isZoomOutKey(key)
}

function matchesZoomReset(code: string, key?: string): boolean {
  if (isZoomResetCode(code)) return true
  return key != null && isZoomResetKey(key)
}

/** Strg/Cmd+Plus/Minus/0 (Vorschau) bzw. Strg/Cmd+Umschalt+… (Oberfläche). */
export function parseZoomShortcutIntent(input: {
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  code: string
  key?: string
}): ZoomShortcutIntent | null {
  if (!input.ctrlKey && !input.metaKey) return null
  if (input.altKey) return null

  const scope: ZoomShortcutScope = input.shiftKey ? 'ui' : 'preview'
  const { code, key } = input

  if (matchesZoomIn(code, key)) return { scope, action: 'in' }
  if (matchesZoomOut(code, key)) return { scope, action: 'out' }
  if (matchesZoomReset(code, key)) return { scope, action: 'reset' }

  return null
}

/** Erkennung für Electron before-input-event (Chromium-Zoom unterbinden). */
export function isChromiumZoomShortcutInput(input: {
  control: boolean
  meta: boolean
  shift?: boolean
  alt?: boolean
  key: string
  code: string
}): boolean {
  if (!input.control && !input.meta) return false
  // Strg+Umschalt+Plus/Minus/0 steuert ui-scale im Renderer — darf nicht blockiert werden.
  if (input.shift || input.alt) return false
  // Nur US-Standard-Positionen (Chromium-Zoom), nicht DE Slash/BracketRight.
  return (
    isZoomInEqualCode(input.code) ||
    isZoomOutMinusCode(input.code) ||
    isZoomResetCode(input.code)
  )
}
