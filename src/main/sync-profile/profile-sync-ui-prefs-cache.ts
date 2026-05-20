/** Zuletzt vom Renderer gemeldete UI-Prefs (localStorage) für Hintergrund-Sync. */
let cachedUiPrefs: Record<string, string> = {}

export function setCachedProfileUiPrefs(prefs: Record<string, string>): void {
  cachedUiPrefs = { ...prefs }
}

export function getCachedProfileUiPrefs(): Record<string, string> {
  return { ...cachedUiPrefs }
}
