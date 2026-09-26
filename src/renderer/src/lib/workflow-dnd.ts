/** Native-Drag Payload fuer Workflow-Konversationen (Thread = mehrere message-Ids). */
export const MIME_THREAD_IDS = 'application/x-mailclient-thread-ids'

/**
 * ToDo-/Termin-Anker: eine Message-ID pro Konversation (neueste / ausgewaehlte Mail).
 * Verschieben in Ordner nutzt weiterhin `MIME_THREAD_IDS` (alle Mails).
 */
export const MIME_TODO_ANCHOR_IDS = 'application/x-mailclient-todo-anchor-ids'

export function readDraggedMessageId(dt: DataTransfer): number | null {
  const candidates = [
    dt.getData('text/plain'),
    dt.getData('text/mailclient-message-id'),
    dt.getData('application/x-mailclient-message-id')
  ]
  for (const raw of candidates) {
    const v = raw.trim()
    if (/^\d+$/.test(v)) return Number.parseInt(v, 10)
  }
  return null
}

function parseIdsFromPlainText(plain: string): number[] {
  const t = plain.trim()
  if (!t) return []
  if (/^\d+$/.test(t)) return [Number.parseInt(t, 10)]
  const parts = t.split(/[\s,;]+/).filter(Boolean)
  const out: number[] = []
  for (const p of parts) {
    if (/^\d+$/.test(p)) out.push(Number.parseInt(p, 10))
  }
  return out.length > 0 ? [...new Set(out)] : []
}

function parseJsonIdArray(raw: string): number[] {
  const t = raw.trim()
  if (!t) return []
  try {
    const parsed = JSON.parse(t) as unknown
    if (!Array.isArray(parsed)) return []
    const out: number[] = []
    for (const x of parsed) {
      if (typeof x === 'number' && Number.isFinite(x)) out.push(x)
      else if (typeof x === 'string' && /^\d+$/.test(x)) out.push(Number.parseInt(x, 10))
    }
    return out.length > 0 ? [...new Set(out)] : []
  } catch {
    return []
  }
}

/**
 * Liest alle Message-IDs aus einem Mail-Workflow-Drag.
 * Hinweis: In Electron/Chromium ist `getData` fuer Custom-MIME oft erst beim `drop`
 * zuverlaessig; `text/plain` mit komma-separierten IDs dient als Fallback.
 */
/** Setzt natives Drag-Payload fuer eine oder mehrere Mail-Message-IDs. */
export function writeMailDragPayload(
  dt: DataTransfer,
  messageIds: readonly number[],
  opts?: { todoAnchorIds?: readonly number[] }
): void {
  const uniq = [...new Set(messageIds.filter((id) => Number.isFinite(id)))].map(Number)
  if (uniq.length === 0) return
  const payload = JSON.stringify(uniq)
  dt.setData(MIME_THREAD_IDS, payload)
  dt.setData('text/plain', uniq.join(','))
  dt.setData('text/mailclient-message-id', String(uniq[0]))
  dt.setData('application/x-mailclient-message-id', String(uniq[0]))
  const anchorsRaw = opts?.todoAnchorIds ?? uniq
  const anchors = [...new Set(anchorsRaw.filter((id) => Number.isFinite(id)))].map(Number)
  dt.setData(MIME_TODO_ANCHOR_IDS, JSON.stringify(anchors.length > 0 ? anchors : [uniq[0]]))
  dt.effectAllowed = 'move'
}

export function readDraggedWorkflowMessageIds(dt: DataTransfer): number[] {
  const fromMime = parseJsonIdArray(dt.getData(MIME_THREAD_IDS))
  if (fromMime.length > 0) return fromMime
  const fromPlain = parseIdsFromPlainText(dt.getData('text/plain'))
  if (fromPlain.length > 0) return fromPlain
  const one = readDraggedMessageId(dt)
  return one != null ? [one] : []
}

/** Message-IDs fuer ToDo setzen / Termin planen (eine pro Konversation). */
export function readDraggedTodoAnchorMessageIds(dt: DataTransfer): number[] {
  const fromMime = parseJsonIdArray(dt.getData(MIME_TODO_ANCHOR_IDS))
  if (fromMime.length > 0) return fromMime
  return readDraggedWorkflowMessageIds(dt)
}
