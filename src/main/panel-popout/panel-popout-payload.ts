const stash = new Map<string, string>()

export function stashPanelPopoutPayload(key: string, payload: unknown): void {
  stash.set(key, JSON.stringify(payload))
}

export function takePanelPopoutPayload<T>(key: string): T | null {
  const raw = stash.get(key)
  if (!raw) return null
  stash.delete(key)
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function clearPanelPopoutPayload(key: string): void {
  stash.delete(key)
}
