import { ipcRenderer } from 'electron'
import { IPC } from '@shared/types'

export const quickCaptureApi = {
  open: (): Promise<void> => ipcRenderer.invoke(IPC.quickCapture.open),
  close: (): Promise<void> => ipcRenderer.invoke(IPC.quickCapture.close),
  toggle: (): Promise<void> => ipcRenderer.invoke(IPC.quickCapture.toggle)
}
