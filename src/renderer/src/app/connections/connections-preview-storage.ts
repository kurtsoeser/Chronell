export type ConnectionsPreviewPlacement = 'dock' | 'float'

export const CONNECTIONS_PREVIEW_PLACEMENT_KEY =
  'mailclient.connections.previewPlacement'
export const CONNECTIONS_FLOAT_PREVIEW_SIZE_KEY =
  'mailclient.connections.floatPreviewSize'
export const CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_KEY =
  'mailclient.connections.previewContextHeight'

/** Standardhoehe des Kontext-Blocks unter der Objekt-Vorschau (px). */
export const CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_DEFAULT = 240
export const CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_MIN = 120
export const CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_MAX = 640

export function readConnectionsPreviewPlacement(): ConnectionsPreviewPlacement {
  try {
    const v = window.localStorage.getItem(CONNECTIONS_PREVIEW_PLACEMENT_KEY)
    return v === 'float' ? 'float' : 'dock'
  } catch {
    return 'dock'
  }
}

export function persistConnectionsPreviewPlacement(
  placement: ConnectionsPreviewPlacement
): void {
  try {
    window.localStorage.setItem(CONNECTIONS_PREVIEW_PLACEMENT_KEY, placement)
  } catch {
    // ignore
  }
}
