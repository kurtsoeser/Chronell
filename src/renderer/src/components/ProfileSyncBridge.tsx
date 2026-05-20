import { useEffect } from 'react'
import {
  replaceLocalStorageFromBackup,
  snapshotLocalStorage
} from '@/lib/local-storage-snapshot'

/** Hintergrund: UI-Prefs an Main melden, auf Cloud-Sync-Events reagieren. */
export function ProfileSyncBridge(): null {
  useEffect(() => {
    const pushPrefs = (): void => {
      void window.mailClient.profileSync.cacheUiPrefs(snapshotLocalStorage())
    }
    pushPrefs()
    const interval = setInterval(pushPrefs, 30_000)
    const onStorage = (): void => {
      pushPrefs()
    }
    window.addEventListener('storage', onStorage)

    const offApplied = window.mailClient.events.onProfileSyncApplied((payload) => {
      replaceLocalStorageFromBackup(payload.localStorage)
      window.location.reload()
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', onStorage)
      offApplied()
    }
  }, [])

  return null
}
