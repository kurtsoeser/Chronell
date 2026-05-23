import { updateConfig } from '../config'
import { scheduleAutoSettingsBackup } from '../settings-auto-backup-service'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let onDebouncedSync: (() => void) | null = null

export function setProfileSyncDebouncedHandler(handler: () => void): void {
  onDebouncedSync = handler
}

export async function markProfileDataDirty(): Promise<void> {
  await updateConfig({ profileCloudLocalDirtyAt: new Date().toISOString() })
  scheduleAutoSettingsBackup()
}

export function scheduleProfileSyncDebounced(delayMs = 5000): void {
  if (!onDebouncedSync) return
  if (debounceTimer != null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    onDebouncedSync?.()
  }, delayMs)
}

export function cancelScheduledProfileSync(): void {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}
