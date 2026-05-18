import { create } from 'zustand'
import { useMailStore } from '@/stores/mail'
import { useMailWorkspaceLayoutStore } from '@/stores/mail-workspace-layout'
import { loadMailReadingPopoutAlwaysOnTopDefault } from '@/app/layout/mail-reading-popout-prefs'

interface MailReadingPopoutState {
  open: boolean
  messageId: number | null
  /** Beim Oeffnen: separates Electron-Fenster statt In-App-Panel. */
  useOsWindow: boolean
  openFromCurrentSelection: (opts?: { osWindow?: boolean }) => void
  openForMessage: (messageId: number, opts?: { osWindow?: boolean }) => void
  close: () => void
}

export const useMailReadingPopoutStore = create<MailReadingPopoutState>((set, get) => ({
  open: false,
  messageId: null,
  useOsWindow: false,

  openFromCurrentSelection: (opts): void => {
    const messageId = useMailStore.getState().selectedMessageId
    if (messageId == null) return
    get().openForMessage(messageId, opts)
  },

  openForMessage: (messageId, opts): void => {
    const osWindow = opts?.osWindow === true
    const layout = useMailWorkspaceLayoutStore.getState()
    if (layout.readingPlacement === 'float') {
      layout.setReadingPlacement('dock')
    }
    if (osWindow) {
      set({ open: false, messageId, useOsWindow: true })
      const msg = useMailStore.getState().selectedMessage
      const title =
        messageId === msg?.id
          ? (msg.subject?.trim() || undefined)
          : undefined
      void window.mailClient.mailReadingPopout
        .open({
          messageId,
          title,
          alwaysOnTop: loadMailReadingPopoutAlwaysOnTopDefault()
        })
        .catch((e) => console.warn('[mail-reading-popout] open OS window:', e))
      return
    }
    set({ open: true, messageId, useOsWindow: false })
  },

  close: (): void => {
    set({ open: false, messageId: null, useOsWindow: false })
  }
}))
