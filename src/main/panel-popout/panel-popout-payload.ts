const stash = new Map<string, string>()

export function stashPanelPopoutPayload(key: string, payload: unknown): void {
  stash.set(key, JSON.stringify(payload))
}

/**
 * Liest den Stash, ohne ihn zu loeschen.
 * Loeschen erst bei Fenster-Close (`clearPanelPopoutPayload`) —
 * sonst leert React StrictMode (doppelter Effect) das Popout und es bleibt schwarz.
 */
export function peekPanelPopoutPayload<T>(key: string): T | null {
  const raw = stash.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * @deprecated Prefer {@link peekPanelPopoutPayload} + {@link clearPanelPopoutPayload}.
 * Behaelt Peek-Semantik (kein Delete), damit bestehende Aufrufer StrictMode-sicher sind.
 */
export function takePanelPopoutPayload<T>(key: string): T | null {
  return peekPanelPopoutPayload<T>(key)
}

export function clearPanelPopoutPayload(key: string): void {
  stash.delete(key)
}
