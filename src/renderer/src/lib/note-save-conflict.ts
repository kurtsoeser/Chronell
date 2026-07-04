/** Prüft, ob die Notiz seit dem letzten Sync extern geändert wurde. */
export function noteSaveConflictDetected(
  baselineUpdatedAt: string,
  remoteUpdatedAt: string
): boolean {
  if (!baselineUpdatedAt || !remoteUpdatedAt) return false
  if (baselineUpdatedAt === remoteUpdatedAt) return false
  const baselineMs = Date.parse(baselineUpdatedAt)
  const remoteMs = Date.parse(remoteUpdatedAt)
  if (Number.isNaN(baselineMs) || Number.isNaN(remoteMs)) {
    return baselineUpdatedAt !== remoteUpdatedAt
  }
  return remoteMs > baselineMs
}
