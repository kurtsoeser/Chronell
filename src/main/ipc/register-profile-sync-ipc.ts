import { ipcMain } from 'electron'
import {
  IPC,
  type ProfileDataMode,
  type ProfileSyncResolution,
  type ProfileSyncRunResult,
  type ProfileSyncStatus
} from '@shared/types'
import {
  getProfileSyncStatus,
  resolveProfileSyncConflict,
  runProfileSyncNow,
  sendProfileSyncOtp,
  setProfileDataMode,
  signInProfileSyncWithMicrosoft365,
  signOutProfileSync,
  verifyProfileSyncOtp
} from '../sync-profile/profile-sync-service'
import { setCachedProfileUiPrefs } from '../sync-profile/profile-sync-ui-prefs-cache'

export function registerProfileSyncIpc(): void {
  ipcMain.removeHandler(IPC.profileSync.getStatus)
  ipcMain.removeHandler(IPC.profileSync.setDataMode)
  ipcMain.removeHandler(IPC.profileSync.sendOtp)
  ipcMain.removeHandler(IPC.profileSync.verifyOtp)
  ipcMain.removeHandler(IPC.profileSync.signOut)
  ipcMain.removeHandler(IPC.profileSync.signInMicrosoft365)
  ipcMain.removeHandler(IPC.profileSync.syncNow)
  ipcMain.removeHandler(IPC.profileSync.resolveConflict)
  ipcMain.removeHandler(IPC.profileSync.cacheUiPrefs)

  ipcMain.handle(IPC.profileSync.getStatus, async (): Promise<ProfileSyncStatus> => {
    return getProfileSyncStatus()
  })

  ipcMain.handle(
    IPC.profileSync.setDataMode,
    async (_event, mode: ProfileDataMode): Promise<ProfileSyncStatus> => {
      if (mode !== 'local' && mode !== 'cloud') {
        throw new Error('Ungültiger Profil-Modus.')
      }
      return setProfileDataMode(mode)
    }
  )

  ipcMain.handle(IPC.profileSync.sendOtp, async (_event, email: string): Promise<void> => {
    if (typeof email !== 'string') {
      throw new Error('E-Mail fehlt.')
    }
    await sendProfileSyncOtp(email)
  })

  ipcMain.handle(
    IPC.profileSync.verifyOtp,
    async (_event, email: string, token: string): Promise<ProfileSyncStatus> => {
      if (typeof email !== 'string' || typeof token !== 'string') {
        throw new Error('E-Mail oder Code fehlt.')
      }
      return verifyProfileSyncOtp(email, token)
    }
  )

  ipcMain.handle(IPC.profileSync.signOut, async (): Promise<ProfileSyncStatus> => {
    return signOutProfileSync()
  })

  ipcMain.handle(
    IPC.profileSync.signInMicrosoft365,
    async (): Promise<ProfileSyncStatus> => {
      return signInProfileSyncWithMicrosoft365()
    }
  )

  ipcMain.handle(
    IPC.profileSync.syncNow,
    async (_event, localStorage: unknown): Promise<ProfileSyncRunResult> => {
      return runProfileSyncNow(parseProfileSyncLocalStorage(localStorage))
    }
  )

  ipcMain.handle(
    IPC.profileSync.resolveConflict,
    async (
      _event,
      resolution: ProfileSyncResolution,
      localStorage: unknown
    ): Promise<ProfileSyncRunResult> => {
      if (resolution !== 'pull' && resolution !== 'push') {
        throw new Error('Ungültige Sync-Auflösung.')
      }
      return resolveProfileSyncConflict(resolution, parseProfileSyncLocalStorage(localStorage))
    }
  )

  ipcMain.handle(
    IPC.profileSync.cacheUiPrefs,
    async (_event, localStorage: unknown): Promise<void> => {
      if (!localStorage || typeof localStorage !== 'object' || Array.isArray(localStorage)) {
        return
      }
      const flat: Record<string, string> = {}
      for (const [k, v] of Object.entries(localStorage as Record<string, unknown>)) {
        if (typeof v === 'string') flat[k] = v
      }
      setCachedProfileUiPrefs(flat)
    }
  )
}

function parseProfileSyncLocalStorage(localStorage: unknown): Record<string, string> {
  if (!localStorage || typeof localStorage !== 'object' || Array.isArray(localStorage)) {
    throw new Error('Ungültiger localStorage-Export.')
  }
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(localStorage as Record<string, unknown>)) {
    if (typeof v === 'string') flat[k] = v
  }
  return flat
}
