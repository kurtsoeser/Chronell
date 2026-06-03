export const COMPOSE_EDITOR_BOTTOM_HEIGHT_KEY = 'mailclient.compose.editorBottomHeight'

/** Standardhöhe Signatur + Original-Mail unter dem Schreibbereich (px). */
export const COMPOSE_EDITOR_BOTTOM_HEIGHT_DEFAULT = 240
export const COMPOSE_EDITOR_BOTTOM_HEIGHT_MIN = 88
export const COMPOSE_EDITOR_BOTTOM_HEIGHT_MAX = 560

export function composeEditorBottomHeightMax(): number {
  if (typeof window === 'undefined') return 360
  return Math.max(
    COMPOSE_EDITOR_BOTTOM_HEIGHT_MIN + 40,
    Math.min(
      COMPOSE_EDITOR_BOTTOM_HEIGHT_MAX,
      Math.round(window.innerHeight * 0.55)
    )
  )
}
