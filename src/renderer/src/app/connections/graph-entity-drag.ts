import type { ChronellEntityRef } from '@shared/entity-ref'

export const GRAPH_ENTITY_DRAG_MIME = 'application/x-chronell-entity-ref'

/** Fallback in text/plain für Electron/Chromium, wo Custom-MIME beim Drop fehlen kann. */
const PLAIN_PREFIX = 'chronell-entity-ref:'

export interface GraphEntityDragPayload {
  ref: ChronellEntityRef
  title: string
}

/** Session-Store: getData() ist in dragover leer — Drop liest ggf. hier. */
let activePaletteDrag: GraphEntityDragPayload | null = null

export function setActivePaletteDrag(payload: GraphEntityDragPayload | null): void {
  activePaletteDrag = payload
}

export function consumeActivePaletteDrag(): GraphEntityDragPayload | null {
  const p = activePaletteDrag
  activePaletteDrag = null
  return p
}

export function isGraphEntityDrag(dataTransfer: DataTransfer): boolean {
  if (activePaletteDrag != null) return true
  if (!dataTransfer?.types?.length) return false
  const types = Array.from(dataTransfer.types)
  return (
    types.includes(GRAPH_ENTITY_DRAG_MIME) || types.includes('application/x-chronell-entity-ref')
  )
}

export function setGraphEntityDragData(
  dataTransfer: DataTransfer,
  payload: GraphEntityDragPayload
): void {
  const json = JSON.stringify(payload)
  setActivePaletteDrag(payload)
  dataTransfer.setData(GRAPH_ENTITY_DRAG_MIME, json)
  dataTransfer.setData('text/plain', `${PLAIN_PREFIX}${json}`)
  dataTransfer.effectAllowed = 'copy'
  try {
    dataTransfer.dropEffect = 'copy'
  } catch {
    /* ignore */
  }
}

export function readGraphEntityDragData(
  dataTransfer: DataTransfer
): GraphEntityDragPayload | null {
  let raw =
    dataTransfer.getData(GRAPH_ENTITY_DRAG_MIME) ||
    dataTransfer.getData('application/x-chronell-entity-ref')

  if (!raw) {
    const plain = dataTransfer.getData('text/plain')
    if (plain.startsWith(PLAIN_PREFIX)) {
      raw = plain.slice(PLAIN_PREFIX.length)
    }
  }

  if (!raw) {
    return activePaletteDrag
  }

  try {
    const parsed = JSON.parse(raw) as GraphEntityDragPayload
    if (!parsed?.ref || typeof parsed.ref !== 'object' || !('kind' in parsed.ref)) return null
    return { ref: parsed.ref, title: String(parsed.title ?? '') }
  } catch {
    return null
  }
}
