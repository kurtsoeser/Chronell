import { updateConfig } from '../config'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let onDebouncedSync: (() => void) | null = null

export function setProfileSyncDebouncedHandler(handler: () => void): void {
  onDebouncedSync = handler
}

export async function markProfileDataDirty(): Promise<void> {
  await updateConfig({ profileCloudLocalDirtyAt: new Date().toISOString() })
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
