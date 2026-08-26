import { ipcMain, app, BrowserWindow, Notification, type IpcMainInvokeEvent } from 'electron'
import { APP_PRODUCT_NAME } from '@shared/app-version'
import { IPC, type AppConnectivityState, type GlobalSearchKind, type GlobalSearchResult } from '@shared/types'
import { globalSearch } from '../global-search'
import { updateConfig } from '../config'
import { normalizeExternalOpenUrl, openExternalDeduped } from '../open-external'
import { getAppConnectivity } from '../network-status'
import { isWin32FramelessTitleBar } from '../window-titlebar'

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return null
  return win
}

export function registerAppIpc(): void {
  ipcMain.handle(IPC.app.getVersion, () => app.getVersion())
  ipcMain.handle(IPC.app.getPlatform, () => process.platform)
  ipcMain.handle(IPC.app.getConnectivity, (): AppConnectivityState => getAppConnectivity())

  ipcMain.handle(
    IPC.app.globalSearch,
    (
      _event,
      args: { query: string; limitPerKind?: number; kinds?: GlobalSearchKind[] }
    ): GlobalSearchResult => {
      const query = typeof args?.query === 'string' ? args.query : ''
      const limitPerKind =
        typeof args?.limitPerKind === 'number' && Number.isFinite(args.limitPerKind)
          ? args.limitPerKind
          : 8
      const kinds = Array.isArray(args?.kinds) ? args.kinds : undefined
      return globalSearch(query, limitPerKind, kinds)
    }
  )

  ipcMain.handle(IPC.app.setLaunchOnLogin, async (_event, enabled: boolean): Promise<void> => {
    await updateConfig({ launchOnLogin: enabled })
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
  })

  ipcMain.handle(IPC.app.showTestNotification, (): void => {
    if (!Notification.isSupported()) return
    new Notification({ title: APP_PRODUCT_NAME, body: 'Benachrichtigungen sind aktiv.' }).show()
  })

  ipcMain.handle(IPC.app.windowMinimize, (event): void => {
    if (!isWin32FramelessTitleBar()) return
    senderWindow(event)?.minimize()
  })

  ipcMain.handle(IPC.app.windowToggleMaximize, (event): void => {
    if (!isWin32FramelessTitleBar()) return
    const win = senderWindow(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle(IPC.app.windowClose, (event): void => {
    if (!isWin32FramelessTitleBar()) return
    senderWindow(event)?.close()
  })

  ipcMain.handle(IPC.app.windowIsMaximized, (event): boolean => {
    if (!isWin32FramelessTitleBar()) return false
    return senderWindow(event)?.isMaximized() ?? false
  })

  ipcMain.handle(IPC.app.openExternal, async (event, url: unknown): Promise<void> => {
    const raw = typeof url === 'string' ? url.trim() : ''
    if (!raw) throw new Error('Keine URL.')
    if (!normalizeExternalOpenUrl(raw)) {
      throw new Error('Diese URL darf nicht extern geoeffnet werden (nicht in der erlaubten Liste).')
    }
    await openExternalDeduped(raw)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.show()
      win.focus()
      if (process.platform === 'win32') {
        win.moveTop()
      }
    }
  })
}
