/**
 * Work IQ nur anbieten, wenn Scope/Tenant ok (Silent-Token) oder explizit freigeschaltet.
 */

const STORAGE_KEY = 'mailclient.workiq.available.v1'
export const WORKIQ_AVAILABILITY_CHANGED_EVENT = 'mailclient:workiq-availability-changed'

function readMap(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, boolean>
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent(WORKIQ_AVAILABILITY_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function readWorkIqAvailablePref(accountId: string): boolean {
  if (!accountId.startsWith('ms:')) return false
  return readMap()[accountId] === true
}

export function persistWorkIqAvailable(accountId: string, available: boolean): void {
  if (!accountId.startsWith('ms:')) return
  const map = readMap()
  if (available) map[accountId] = true
  else delete map[accountId]
  writeMap(map)
}

export async function probeWorkIqAvailability(accountId: string): Promise<boolean> {
  if (!accountId.startsWith('ms:')) return false
  if (readWorkIqAvailablePref(accountId)) return true
  try {
    const res = await window.mailClient.copilot.workIqStatus({ accountId })
    if (res.available) {
      persistWorkIqAvailable(accountId, true)
      return true
    }
  } catch {
    // ignore
  }
  return false
}

/** Interactive consent (Settings „freischalten“). */
export async function enableWorkIqAvailability(accountId: string): Promise<{
  available: boolean
  errorMessage?: string
}> {
  if (!accountId.startsWith('ms:')) {
    return { available: false, errorMessage: 'Microsoft-Konto erforderlich.' }
  }
  try {
    const res = await window.mailClient.copilot.workIqEnable({ accountId })
    if (res.available) {
      persistWorkIqAvailable(accountId, true)
      return { available: true }
    }
    return { available: false, errorMessage: res.errorMessage ?? undefined }
  } catch (err) {
    return {
      available: false,
      errorMessage: err instanceof Error ? err.message : String(err)
    }
  }
}
