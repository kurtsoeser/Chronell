const ALWAYS_ON_TOP_KEY = 'mailclient.mailReadingPopout.alwaysOnTop'

export function loadMailReadingPopoutAlwaysOnTopDefault(): boolean {
  try {
    const v = window.localStorage.getItem(ALWAYS_ON_TOP_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

export function saveMailReadingPopoutAlwaysOnTopDefault(enabled: boolean): void {
  try {
    window.localStorage.setItem(ALWAYS_ON_TOP_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}
