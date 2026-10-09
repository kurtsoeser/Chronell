import { create } from 'zustand'
import {
  type CalendarShellColumnId,
  moveCalendarShellColumn,
  persistCalendarShellColumnOrder,
  readCalendarShellColumnOrder
} from '@/app/calendar/calendar-shell-column-order'
import {
  persistLeftSidebarCollapsed,
  persistRightInboxOpen,
  persistRightPreviewOpen,
  readLeftSidebarCollapsedFromStorage,
  readRightInboxOpenFromStorage,
  readRightPreviewOpenFromStorage
} from '@/app/calendar/calendar-shell-storage'

/** Rechte Kalender-Seitenpanels: eingebettet in der Zeile oder als schwebendes Fenster. */
export type CalendarSidePanelPlacement = 'dock' | 'float'

const K_INBOX = 'mailclient.calendarPanel.inboxPlacement'
const K_PREVIEW = 'mailclient.calendarPanel.previewPlacement'
const K_CONTEXT = 'mailclient.calendarPanel.contextPlacement'
const K_CONTEXT_OPEN = 'mailclient.calendarPanel.contextOpen'
const K_CALENDAR_COLUMN_OPEN = 'mailclient.calendarPanel.calendarColumnOpen'

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
  /** Mini-Kalender / Konten-Nav in der Kalender-Ansicht. */
  leftSidebarCollapsed: boolean
  rightInboxOpen: boolean
  rightPreviewOpen: boolean
  /** Haupt-Kalender-Spalte (Wochenraster) in der Dock-Zeile. */
  calendarColumnOpen: boolean
  columnOrder: CalendarShellColumnId[]
  setInboxPlacement: (p: CalendarSidePanelPlacement) => void
  setPreviewPlacement: (p: CalendarSidePanelPlacement) => void
  setContextPlacement: (p: CalendarSidePanelPlacement) => void
  setContextOpen: (open: boolean) => void
  setLeftSidebarCollapsed: (collapsed: boolean) => void
  setRightInboxOpen: (open: boolean) => void
  setRightPreviewOpen: (open: boolean) => void
  setCalendarColumnOpen: (open: boolean) => void
  setColumnOrder: (order: CalendarShellColumnId[]) => void
  moveColumn: (id: CalendarShellColumnId, delta: -1 | 1) => void
}

export const useCalendarPanelLayoutStore = create<CalendarPanelLayoutState>((set) => ({
  inboxPlacement: readPlacement(K_INBOX, 'dock'),
  /** Vorschau: Standard angedockt (wie Mail-Lesevorschau); Abdocken oeffnet Pop-up/OS-Fenster. */
  previewPlacement: readPlacement(K_PREVIEW, 'dock'),
  contextPlacement: readPlacement(K_CONTEXT, 'dock'),
  contextOpen: readBool(K_CONTEXT_OPEN, false),
  leftSidebarCollapsed: readLeftSidebarCollapsedFromStorage(),
  rightInboxOpen: readRightInboxOpenFromStorage(),
  rightPreviewOpen: readRightPreviewOpenFromStorage(),
  calendarColumnOpen: readBool(K_CALENDAR_COLUMN_OPEN, true),
  columnOrder: readCalendarShellColumnOrder(),
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
  },
  setLeftSidebarCollapsed(collapsed): void {
    persistLeftSidebarCollapsed(collapsed)
    set({ leftSidebarCollapsed: collapsed })
  },
  setRightInboxOpen(open): void {
    persistRightInboxOpen(open)
    set({ rightInboxOpen: open })
  },
  setRightPreviewOpen(open): void {
    persistRightPreviewOpen(open)
    set({ rightPreviewOpen: open })
  },
  setCalendarColumnOpen(open): void {
    writeBool(K_CALENDAR_COLUMN_OPEN, open)
    set({ calendarColumnOpen: open })
  },
  setColumnOrder(order): void {
    persistCalendarShellColumnOrder(order)
    set({ columnOrder: order })
  },
  moveColumn(id, delta): void {
    set((state) => {
      const next = moveCalendarShellColumn(state.columnOrder, id, delta)
      persistCalendarShellColumnOrder(next)
      return { columnOrder: next }
    })
  }
}))
