import { readNotesSettingsPrefs } from '@/lib/notes-settings-prefs'

export type NotesSidebarListMode = 'accounts' | 'sections'

const LIST_MODE_KEY = 'mailclient.notes.sidebarListMode'
const ACCOUNT_OPEN_KEY = 'mailclient.notes.accountSidebarOpen'

export function readNotesSidebarListMode(): NotesSidebarListMode {
  try {
    const v = window.localStorage.getItem(LIST_MODE_KEY)
    if (v === 'accounts' || v === 'sections') return v
  } catch {
    /* ignore */
  }
  return readNotesSettingsPrefs().defaultSidebarListMode
}

export function persistNotesSidebarListMode(mode: NotesSidebarListMode): void {
  try {
    window.localStorage.setItem(LIST_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function readNotesAccountSidebarOpen(accountKeys: string[]): Record<string, boolean> {
  const defaultOpen = !readNotesSettingsPrefs().defaultAccountsCollapsed
  let stored: Record<string, boolean> = {}
  try {
    const raw = window.localStorage.getItem(ACCOUNT_OPEN_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'boolean') stored[k] = v
        }
      }
    }
  } catch {
    stored = {}
  }
  const out: Record<string, boolean> = {}
  for (const key of accountKeys) {
    out[key] = typeof stored[key] === 'boolean' ? stored[key] : defaultOpen
  }
  return out
}

export function persistNotesAccountSidebarOpen(open: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(ACCOUNT_OPEN_KEY, JSON.stringify(open))
  } catch {
    /* ignore */
  }
}
