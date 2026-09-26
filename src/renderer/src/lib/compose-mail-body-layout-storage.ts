export const COMPOSE_EDITOR_BOTTOM_HEIGHT_KEY = 'mailclient.compose.editorBottomHeight'

/**
 * Maximale Höhe (Cap) für Signatur + Original-Mail unter dem Schreibbereich (px).
 * Der Bereich selbst ist inhaltsbasiert — eingeklappt bleibt nur die Kopfzeile.
 */
export const COMPOSE_EDITOR_BOTTOM_HEIGHT_DEFAULT = 220
export const COMPOSE_EDITOR_BOTTOM_HEIGHT_MIN = 72
export const COMPOSE_EDITOR_BOTTOM_HEIGHT_MAX = 480

export function composeEditorBottomHeightMax(): number {
  if (typeof window === 'undefined') return 280
  // In schmalen Popout-Fenstern den Schreibbereich priorisieren (max. ~40 %).
  return Math.max(
    COMPOSE_EDITOR_BOTTOM_HEIGHT_MIN + 40,
    Math.min(
      COMPOSE_EDITOR_BOTTOM_HEIGHT_MAX,
      Math.round(window.innerHeight * 0.4)
    )
  )
}
