import { globalShortcut } from 'electron'
import { broadcastNotesScreenClipTrigger } from './ipc/ipc-broadcasts'
import { toggleQuickCapturePopout } from './quick-capture-popout'
import { logBackgroundError } from './log-background-error'

const SCREEN_CLIP_ACCELERATOR = 'CommandOrControl+Shift+Alt+S'
const QUICK_CAPTURE_ACCELERATOR = 'CommandOrControl+Shift+Alt+N'

export function registerNotesGlobalShortcuts(): void {
  try {
    if (!globalShortcut.isRegistered(SCREEN_CLIP_ACCELERATOR)) {
      const ok = globalShortcut.register(SCREEN_CLIP_ACCELERATOR, () => {
        broadcastNotesScreenClipTrigger()
      })
      if (!ok) {
        logBackgroundError('notes-shortcuts', new Error('Screen-Clip-Hotkey konnte nicht registriert werden.'))
      }
    }
  } catch (e) {
    logBackgroundError('notes-shortcuts-screen-clip', e)
  }

  try {
    if (!globalShortcut.isRegistered(QUICK_CAPTURE_ACCELERATOR)) {
      const ok = globalShortcut.register(QUICK_CAPTURE_ACCELERATOR, () => {
        toggleQuickCapturePopout()
      })
      if (!ok) {
        logBackgroundError('notes-shortcuts', new Error('Quick-Capture-Hotkey konnte nicht registriert werden.'))
      }
    }
  } catch (e) {
    logBackgroundError('notes-shortcuts-quick-capture', e)
  }
}

export function unregisterNotesGlobalShortcuts(): void {
  for (const accelerator of [SCREEN_CLIP_ACCELERATOR, QUICK_CAPTURE_ACCELERATOR]) {
    try {
      if (globalShortcut.isRegistered(accelerator)) {
        globalShortcut.unregister(accelerator)
      }
    } catch {
      // ignore
    }
  }
}
