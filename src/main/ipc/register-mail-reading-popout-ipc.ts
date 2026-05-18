import { ipcMain } from 'electron'
import { IPC, type MailReadingPopoutOpenInput } from '@shared/types'
import {
  closeAllMailReadingPopouts,
  closeMailReadingPopout,
  focusMailReadingPopout,
  getMailReadingPopoutAlwaysOnTop,
  isMailReadingPopoutOpen,
  openMailReadingPopout,
  setMailReadingPopoutAlwaysOnTop
} from '../mail-reading-popout'

export function registerMailReadingPopoutIpc(): void {
  ipcMain.handle(IPC.mailReadingPopout.open, (_event, input: MailReadingPopoutOpenInput): void => {
    openMailReadingPopout(input)
  })

  ipcMain.handle(
    IPC.mailReadingPopout.close,
    (_event, args: { messageId: number }): void => {
      const messageId = typeof args?.messageId === 'number' ? args.messageId : 0
      if (!Number.isFinite(messageId) || messageId <= 0) return
      closeMailReadingPopout(messageId)
    }
  )

  ipcMain.handle(IPC.mailReadingPopout.closeAll, (): void => {
    closeAllMailReadingPopouts()
  })

  ipcMain.handle(
    IPC.mailReadingPopout.focus,
    (_event, args: { messageId: number }): boolean => {
      const messageId = typeof args?.messageId === 'number' ? args.messageId : 0
      if (!Number.isFinite(messageId) || messageId <= 0) return false
      return focusMailReadingPopout(messageId)
    }
  )

  ipcMain.handle(
    IPC.mailReadingPopout.isOpen,
    (_event, args: { messageId: number }): boolean => {
      const messageId = typeof args?.messageId === 'number' ? args.messageId : 0
      if (!Number.isFinite(messageId) || messageId <= 0) return false
      return isMailReadingPopoutOpen(messageId)
    }
  )

  ipcMain.handle(
    IPC.mailReadingPopout.getAlwaysOnTop,
    (_event, args: { messageId: number }): boolean => {
      const messageId = typeof args?.messageId === 'number' ? args.messageId : 0
      if (!Number.isFinite(messageId) || messageId <= 0) return false
      return getMailReadingPopoutAlwaysOnTop(messageId)
    }
  )

  ipcMain.handle(
    IPC.mailReadingPopout.setAlwaysOnTop,
    (_event, args: { messageId: number; alwaysOnTop: boolean }): void => {
      const messageId = typeof args?.messageId === 'number' ? args.messageId : 0
      if (!Number.isFinite(messageId) || messageId <= 0) return
      setMailReadingPopoutAlwaysOnTop(messageId, args.alwaysOnTop === true)
    }
  )
}
