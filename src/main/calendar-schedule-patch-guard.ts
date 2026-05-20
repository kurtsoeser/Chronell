import type { CalendarPatchScheduleInput } from '@shared/types'

const PATCH_GUARD_MS = 90_000

interface SchedulePatchGuardEntry {
  startIso: string
  endIso: string
  isAllDay: boolean
  patchedAt: number
}

const guards = new Map<string, SchedulePatchGuardEntry>()

function guardKey(accountId: string, graphEventId: string): string {
  return `${accountId.trim()}\u001f${graphEventId.trim()}`
}

export function registerSchedulePatchGuard(input: CalendarPatchScheduleInput): void {
  const graphEventId = input.graphEventId?.trim()
  if (!graphEventId) return
  guards.set(guardKey(input.accountId, graphEventId), {
    startIso: input.startIso,
    endIso: input.endIso,
    isAllDay: input.isAllDay,
    patchedAt: Date.now()
  })
}

export function getActiveSchedulePatchGuard(
  accountId: string,
  graphEventId: string
): SchedulePatchGuardEntry | null {
  const entry = guards.get(guardKey(accountId, graphEventId))
  if (!entry) return null
  if (Date.now() - entry.patchedAt > PATCH_GUARD_MS) {
    guards.delete(guardKey(accountId, graphEventId))
    return null
  }
  return entry
}

export function clearSchedulePatchGuard(accountId: string, graphEventId: string): void {
  guards.delete(guardKey(accountId, graphEventId))
}
