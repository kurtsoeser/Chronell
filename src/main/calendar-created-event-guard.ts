/** Verhindert, dass frisch angelegte Termine beim Hintergrund-Sync sofort wieder aus dem Cache entfernt werden. */

const CREATED_GUARD_MS = 120_000

const guards = new Map<string, number>()

function guardKey(accountId: string, graphEventId: string): string {
  return `${accountId.trim()}\u001f${graphEventId.trim()}`
}

export function registerCreatedCalendarEventGuard(accountId: string, graphEventId: string): void {
  const id = graphEventId.trim()
  if (!id) return
  guards.set(guardKey(accountId, id), Date.now())
}

export function isCreatedCalendarEventGuarded(accountId: string, graphEventId: string): boolean {
  const key = guardKey(accountId, graphEventId)
  const patchedAt = guards.get(key)
  if (patchedAt == null) return false
  if (Date.now() - patchedAt > CREATED_GUARD_MS) {
    guards.delete(key)
    return false
  }
  return true
}
