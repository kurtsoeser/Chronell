/** Vollständiger Export des Renderer-localStorage (für Backup & Cloud-Sync). */
export function snapshotLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k != null) out[k] = window.localStorage.getItem(k) ?? ''
  }
  return out
}

export function replaceLocalStorageFromBackup(entries: Record<string, string>): void {
  window.localStorage.clear()
  for (const [k, v] of Object.entries(entries)) {
    window.localStorage.setItem(k, v)
  }
}
