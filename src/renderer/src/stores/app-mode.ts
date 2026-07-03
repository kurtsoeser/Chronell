import { create } from 'zustand'
import { writeActiveCustomViewId } from '@/app/custom-views/custom-views-storage'
import { flushNotesEditorBeforeLeave } from '@/lib/notes-editor-flush-bridge'

export type AppShellMode =
  | 'home'
  | 'mail'
  | 'calendar'
  | 'bookings'
  | 'tasks'
  | 'work'
  | 'people'
  | 'notes'
  | 'files'
  | 'connections'
  | 'chat'
  /** Benutzerdefinierte Ansicht aus dem Layout-Assistenten */
  | 'customView'

const STORAGE_KEY = 'mailclient.appShellMode'

/** Nach Öffnen der App: Mail-Einstellungen → Regeln (Migration vom Top-Level-Modul). */
export const PENDING_MAIL_RULES_SETTINGS_KEY = 'mailclient.pendingMailRulesSettings'

/** Entferntes Workflow-Modul: gespeicherte Ansicht auf „Alle Arbeit“ umleiten. */
function migrateLegacyWorkflowMode(): void {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'workflow') {
      window.localStorage.setItem(STORAGE_KEY, 'work')
    }
  } catch {
    // ignore
  }
}

/** Zeitliste ist Teil des Kalender-Moduls (rechte Spalte „Zeitliste“). */
function migrateLegacyMegaMode(): void {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'mega') {
      window.localStorage.setItem(STORAGE_KEY, 'calendar')
    }
  } catch {
    // ignore
  }
}

/** Entferntes Layout-Labor: auf Start umleiten (eigene Ansichten ersetzen das Modul). */
function migrateLegacyLayoutStudioMode(): void {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'layoutStudio') {
      window.localStorage.setItem(STORAGE_KEY, 'home')
    }
  } catch {
    // ignore
  }
}

function readStored(): AppShellMode {
  try {
    migrateLegacyWorkflowMode()
    migrateLegacyMegaMode()
    migrateLegacyLayoutStudioMode()
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'focus' || v === 'rules') {
      persist('mail')
      if (v === 'rules') {
        try {
          window.localStorage.setItem(PENDING_MAIL_RULES_SETTINGS_KEY, '1')
        } catch {
          // ignore
        }
      }
      return 'mail'
    }
    if (
      v === 'home' ||
      v === 'mail' ||
      v === 'calendar' ||
      v === 'bookings' ||
      v === 'tasks' ||
      v === 'work' ||
      v === 'people' ||
      v === 'notes' ||
      v === 'files' ||
      v === 'connections' ||
      v === 'chat' ||
      v === 'customView'
    )
      return v
  } catch {
    // ignore
  }
  return 'home'
}

function persist(mode: AppShellMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

interface AppModeState {
  mode: AppShellMode
  setMode: (mode: AppShellMode) => void
  setCustomView: (viewId: string) => void
}

export const useAppModeStore = create<AppModeState>((set, get) => ({
  mode: readStored(),
  setMode(mode): void {
    const prev = get().mode
    if (prev === 'notes' && mode !== 'notes') {
      void flushNotesEditorBeforeLeave().finally(() => {
        persist(mode)
        set({ mode })
      })
      return
    }
    persist(mode)
    set({ mode })
  },
  setCustomView(viewId): void {
    const prev = get().mode
    if (prev === 'notes') {
      void flushNotesEditorBeforeLeave().finally(() => {
        persist('customView')
        writeActiveCustomViewId(viewId)
        set({ mode: 'customView' })
      })
      return
    }
    persist('customView')
    writeActiveCustomViewId(viewId)
    set({ mode: 'customView' })
  }
}))
