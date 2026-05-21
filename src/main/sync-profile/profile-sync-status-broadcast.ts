import { BrowserWindow } from 'electron'
import type { ProfileSyncStatus } from '@shared/types'

type ProfileSyncStatusReader = () => Promise<ProfileSyncStatus>

let readStatus: ProfileSyncStatusReader | null = null

export function registerProfileSyncStatusReader(reader: ProfileSyncStatusReader): void {
  readStatus = reader
}

export function broadcastProfileSyncStatus(): void {
  if (!readStatus) return
  void readStatus().then((status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('profile-sync:status', status)
    }
  })
}

export function broadcastProfileSyncApplied(localStorage: Record<string, string>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('profile-sync:applied', { localStorage })
  }
}
