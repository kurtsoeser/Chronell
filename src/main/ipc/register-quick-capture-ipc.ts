import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import {
  closeQuickCapturePopout,
  openQuickCapturePopout,
  toggleQuickCapturePopout
} from '../quick-capture-popout'

export function registerQuickCaptureIpc(): void {
  ipcMain.handle(IPC.quickCapture.open, (): void => {
    openQuickCapturePopout()
  })

  ipcMain.handle(IPC.quickCapture.close, (): void => {
    closeQuickCapturePopout()
  })

  ipcMain.handle(IPC.quickCapture.toggle, (): void => {
    toggleQuickCapturePopout()
  })
}
