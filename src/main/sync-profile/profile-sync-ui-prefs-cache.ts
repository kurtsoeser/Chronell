/** Zuletzt vom Renderer gemeldete UI-Prefs (localStorage) für Hintergrund-Sync. */
let cachedUiPrefs: Record<string, string> = {}

function uiPrefsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a).sort()
  const keysB = Object.keys(b).sort()
  if (keysA.length !== keysB.length) return false
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i]!
    if (k !== keysB[i]) return false
    if (a[k] !== b[k]) return false
  }
  return true
}

/** Aktualisiert den Cache; `true` wenn sich die UI-Prefs gegenüber dem letzten Cache geändert haben. */
export function setCachedProfileUiPrefs(prefs: Record<string, string>): boolean {
  const next = { ...prefs }
  const changed = Object.keys(cachedUiPrefs).length > 0 && !uiPrefsEqual(cachedUiPrefs, next)
  cachedUiPrefs = next
  return changed
}

export function getCachedProfileUiPrefs(): Record<string, string> {
  return { ...cachedUiPrefs }
}
