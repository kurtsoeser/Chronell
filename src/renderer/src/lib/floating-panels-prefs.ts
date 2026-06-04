const USE_OS_WINDOWS_KEY = 'mailclient.floatingPanels.useOsWindows'

/** Abgedockte Mail-Vorschau als eigenes Fenster auf dem Bildschirm (nicht nur innerhalb Chronell). */
export function loadUseOsFloatingPanelsDefault(): boolean {
  try {
    const v = window.localStorage.getItem(USE_OS_WINDOWS_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

export function saveUseOsFloatingPanelsDefault(enabled: boolean): void {
  try {
    window.localStorage.setItem(USE_OS_WINDOWS_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}
