import { ipcMain, dialog, BrowserWindow, type SaveDialogOptions } from 'electron'
import { IPC } from '@shared/types'
import {
  exportDemoPackTo,
  getDemoStatus,
  relaunchWithDemoFlag,
  resetDemoProfile
} from '../demo/demo-service'

export function registerDemoIpc(): void {
  ipcMain.removeHandler(IPC.demo.getStatus)
  ipcMain.removeHandler(IPC.demo.enter)
  ipcMain.removeHandler(IPC.demo.exit)
  ipcMain.removeHandler(IPC.demo.reset)
  ipcMain.removeHandler(IPC.demo.exportPack)

  ipcMain.handle(IPC.demo.getStatus, async () => getDemoStatus())

  ipcMain.handle(IPC.demo.enter, async () => {
    relaunchWithDemoFlag(true)
  })

  ipcMain.handle(IPC.demo.exit, async () => {
    relaunchWithDemoFlag(false)
  })

  ipcMain.handle(IPC.demo.reset, async () => {
    await resetDemoProfile()
  })

  ipcMain.handle(IPC.demo.exportPack, async (event): Promise<{ ok: boolean; path?: string; cancelled?: boolean }> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: SaveDialogOptions = {
      title: 'Demo-Datenpaket exportieren',
      defaultPath: `chronell-demo-export-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'ZIP-Archiv', extensions: ['zip'] }]
    }
    const { canceled, filePath } = await (win
      ? dialog.showSaveDialog(win, options)
      : dialog.showSaveDialog(options))
    if (canceled || !filePath) {
      return { ok: false, cancelled: true }
    }
    const path = await exportDemoPackTo(filePath)
    return { ok: true, path }
  })
}
