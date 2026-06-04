/** Cloud-Snapshot ist neuer als letzter Pull — anderes Gerät hat kürzlich geschrieben. */
export function computeConflictRemoteNewer(
  remoteMs: number,
  localPulledAt: number,
  localPushedAt: number
): boolean {
  if (!Number.isFinite(remoteMs) || remoteMs <= 0) return false
  return remoteMs > localPulledAt && remoteMs > localPushedAt
}

/**
 * Cloud und lokaler Stand weichen ab — Nutzerwahl nötig (kein Auto-Pull/Push).
 * Nur wenn lokale Änderungen offen sind und die Cloud einen anderen Stand hat.
 */
export function computeConflictPending(
  remoteMs: number,
  localPulledAt: number,
  localPushedAt: number,
  localDirty: boolean,
  hasRemote: boolean
): boolean {
  if (!hasRemote || !Number.isFinite(remoteMs) || remoteMs <= 0) return false
  if (!localDirty) return false

  if (remoteMs <= localPulledAt) {
    return localPushedAt > 0 && remoteMs > localPushedAt
  }

  return true
}
