import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { MailListItem } from '@shared/types'
import { useAppModeStore } from '@/stores/app-mode'
import { useConnectionsGraphFocusStore } from '@/stores/connections-graph-focus'

/** Wechselt ins Modul „Verbindungen“ und markiert einen Knoten im Graphen. */
export function openConnectionsGraphForRef(ref: ChronellEntityRef): void {
  useConnectionsGraphFocusStore.getState().setHighlightRef(ref)
  useAppModeStore.getState().setMode('connections')
}

/** Graph-Knoten: Scan-Panel mit diesem Objekt als Anker öffnen (alle Objektarten). */
export function openGraphNodeAiSuggestLinks(ref: ChronellEntityRef, title: string): void {
  const key = entityRefKey(ref)
  const store = useConnectionsGraphFocusStore.getState()
  store.setHighlightRef(ref)
  store.requestAiScanForRefs([ref], new Map([[key, title.trim() || key]]), { autoStart: true })
  useAppModeStore.getState().setMode('connections')
}

/** Verbindungen öffnen und KI-Scan für die angegebenen Mails starten (Panel). */
export function openConnectionsGraphWithAiScan(
  messages: MailListItem[],
  opts?: { maxMessages?: number }
): void {
  const max = opts?.maxMessages ?? 10
  const slice = messages.slice(-max)
  const titles = new Map<string, string>()
  const refs: ChronellEntityRef[] = []
  for (const m of slice) {
    const ref: ChronellEntityRef = { kind: 'mail', messageId: m.id }
    const key = entityRefKey(ref)
    titles.set(key, m.subject?.trim() || m.fromName?.trim() || m.fromAddr || `#${m.id}`)
    refs.push(ref)
  }
  if (refs.length === 0) return
  const store = useConnectionsGraphFocusStore.getState()
  if (refs.length === 1) store.setHighlightRef(refs[0]!)
  store.requestAiScanForRefs(refs, titles)
  useAppModeStore.getState().setMode('connections')
}
