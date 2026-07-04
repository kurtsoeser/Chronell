import { ipcRenderer } from 'electron'
import { IPC, type DemoStatus } from '@shared/types'

export const demoApi = {
  getStatus: (): Promise<DemoStatus> => ipcRenderer.invoke(IPC.demo.getStatus),
  enter: (): Promise<void> => ipcRenderer.invoke(IPC.demo.enter),
  exit: (): Promise<void> => ipcRenderer.invoke(IPC.demo.exit),
  reset: (): Promise<void> => ipcRenderer.invoke(IPC.demo.reset),
  exportPack: (): Promise<{ ok: boolean; path?: string; cancelled?: boolean }> =>
    ipcRenderer.invoke(IPC.demo.exportPack)
}
