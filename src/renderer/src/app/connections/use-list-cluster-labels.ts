import { useEffect, useMemo, useState } from 'react'
import type { EntityGraphNode } from '@shared/entity-links'

function parseAccountScopedListKey(
  clusterKey: string,
  prefix: 'cal:' | 'tasklist:'
): { accountId: string; listId: string } | null {
  if (!clusterKey.startsWith(prefix)) return null
  const unknown = prefix === 'cal:' ? 'cal:unknown' : 'tasklist:unknown'
  if (clusterKey === unknown) return null
  const rest = clusterKey.slice(prefix.length)
  const colon = rest.indexOf(':')
  if (colon <= 0) return null
  const listId = rest.slice(colon + 1)
  if (!listId) return null
  return { accountId: rest.slice(0, colon), listId }
}

function labelsFromNodes(nodes: readonly EntityGraphNode[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const n of nodes) {
    if (n.layoutCalendarList && n.layoutCalendarListLabel) {
      m[n.layoutCalendarList] = n.layoutCalendarListLabel
    }
    if (n.layoutTaskList && n.layoutTaskListLabel) {
      m[n.layoutTaskList] = n.layoutTaskListLabel
    }
  }
  return m
}

function unresolvedListKeys(
  nodes: readonly EntityGraphNode[],
  known: Record<string, string>
): string[] {
  const keys = new Set<string>()
  for (const n of nodes) {
    if (n.layoutCalendarList && !known[n.layoutCalendarList]) {
      keys.add(n.layoutCalendarList)
    }
    if (n.layoutTaskList && !known[n.layoutTaskList]) {
      keys.add(n.layoutTaskList)
    }
  }
  return [...keys]
}

/** Kalender- und Aufgabenlisten-Namen fuer Graph-Insel-Labels (Cache + IPC-Fallback). */
export function useListClusterLabels(nodes: readonly EntityGraphNode[]): Record<string, string> {
  const fromNodes = useMemo(() => labelsFromNodes(nodes), [nodes])
  const missingKeys = useMemo(
    () => unresolvedListKeys(nodes, fromNodes),
    [nodes, fromNodes]
  )
  const missingKeysSig = missingKeys.join('\0')

  const accountIds = useMemo(() => {
    const ids = new Set<string>()
    for (const key of missingKeys) {
      const cal = parseAccountScopedListKey(key, 'cal:')
      if (cal) ids.add(cal.accountId)
      const task = parseAccountScopedListKey(key, 'tasklist:')
      if (task) ids.add(task.accountId)
    }
    return [...ids]
  }, [missingKeysSig])

  const [resolved, setResolved] = useState<Record<string, string>>({})

  useEffect(() => {
    if (missingKeys.length === 0) {
      setResolved({})
      return
    }
    let cancelled = false
    void (async () => {
      const calendarNames = new Map<string, Map<string, string>>()
      const taskNames = new Map<string, Map<string, string>>()

      await Promise.all(
        accountIds.map(async (accountId) => {
          try {
            const [calendars, lists] = await Promise.all([
              window.mailClient.calendar.listCalendars({ accountId }),
              window.mailClient.tasks.listLists({ accountId, cacheOnly: true })
            ])
            calendarNames.set(accountId, new Map(calendars.map((c) => [c.id, c.name])))
            taskNames.set(accountId, new Map(lists.map((l) => [l.id, l.name])))
          } catch {
            /* Cache/API nicht verfuegbar */
          }
        })
      )

      if (cancelled) return
      const next: Record<string, string> = {}
      for (const key of missingKeys) {
        const cal = parseAccountScopedListKey(key, 'cal:')
        if (cal) {
          const name = calendarNames.get(cal.accountId)?.get(cal.listId)?.trim()
          if (name) next[key] = name
          continue
        }
        const task = parseAccountScopedListKey(key, 'tasklist:')
        if (task) {
          const name = taskNames.get(task.accountId)?.get(task.listId)?.trim()
          if (name) next[key] = name
        }
      }
      setResolved(next)
    })()

    return () => {
      cancelled = true
    }
  }, [missingKeysSig, accountIds.join('\0')])

  return useMemo(() => ({ ...resolved, ...fromNodes }), [fromNodes, resolved])
}
