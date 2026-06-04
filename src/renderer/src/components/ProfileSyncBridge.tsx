import { useEffect } from 'react'
import { CUSTOM_VIEWS_CHANGED_EVENT } from '@/stores/custom-views'
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
    window.addEventListener(CUSTOM_VIEWS_CHANGED_EVENT, pushPrefs)

    const offApplied = window.mailClient.events.onProfileSyncApplied((payload) => {
      replaceLocalStorageFromBackup(payload.localStorage)
      window.location.reload()
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CUSTOM_VIEWS_CHANGED_EVENT, pushPrefs)
      offApplied()
    }
  }, [])

  return null
}
