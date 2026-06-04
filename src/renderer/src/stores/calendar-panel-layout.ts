import { create } from 'zustand'

/** Rechte Kalender-Seitenpanels: eingebettet in der Zeile oder als schwebendes Fenster. */
export type CalendarSidePanelPlacement = 'dock' | 'float'

const K_INBOX = 'mailclient.calendarPanel.inboxPlacement'
const K_PREVIEW = 'mailclient.calendarPanel.previewPlacement'
const K_CONTEXT = 'mailclient.calendarPanel.contextPlacement'
const K_CONTEXT_OPEN = 'mailclient.calendarPanel.contextOpen'

function readPlacement(key: string, fallback: CalendarSidePanelPlacement): CalendarSidePanelPlacement {
  try {
    const v = window.localStorage.getItem(key)
    if (v === 'dock' || v === 'float') return v
  } catch {
    // ignore
  }
  return fallback
}

function writePlacement(key: string, value: CalendarSidePanelPlacement): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key)
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    // ignore
  }
  return fallback
}

function writeBool(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // ignore
  }
}

interface CalendarPanelLayoutState {
  inboxPlacement: CalendarSidePanelPlacement
  previewPlacement: CalendarSidePanelPlacement
  contextPlacement: CalendarSidePanelPlacement
  contextOpen: boolean
  setInboxPlacement: (p: CalendarSidePanelPlacement) => void
  setPreviewPlacement: (p: CalendarSidePanelPlacement) => void
  setContextPlacement: (p: CalendarSidePanelPlacement) => void
  setContextOpen: (open: boolean) => void
}

export const useCalendarPanelLayoutStore = create<CalendarPanelLayoutState>((set) => ({
  inboxPlacement: readPlacement(K_INBOX, 'dock'),
  /** Vorschau: Standard „losgeloest“ (Pop-up); laesst sich andocken. */
  previewPlacement: readPlacement(K_PREVIEW, 'float'),
  contextPlacement: readPlacement(K_CONTEXT, 'dock'),
  contextOpen: readBool(K_CONTEXT_OPEN, false),
  setInboxPlacement(p): void {
    writePlacement(K_INBOX, p)
    set({ inboxPlacement: p })
  },
  setPreviewPlacement(p): void {
    writePlacement(K_PREVIEW, p)
    set({ previewPlacement: p })
  },
  setContextPlacement(p): void {
    writePlacement(K_CONTEXT, p)
    set({ contextPlacement: p })
  },
  setContextOpen(open): void {
    writeBool(K_CONTEXT_OPEN, open)
    set({ contextOpen: open })
  }
}))
