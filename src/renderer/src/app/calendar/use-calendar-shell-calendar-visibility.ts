import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarGraphCalendarRow, ConnectedAccount } from '@shared/types'
import { M365_GROUP_CALENDAR_ID_PREFIX } from '@shared/microsoft-m365-group-calendar'
import {
  parseAccountSidebarOpenFromStorage,
  parseGroupCalSidebarOpenFromStorage,
  persistAccountSidebarOpen,
  persistGroupCalSidebarOpen
} from '@/app/calendar/calendar-shell-storage'
import type { CalendarSidebarHiddenRestoreEntry } from '@/app/calendar/CalendarShellHeader'
import {
  CALENDAR_VISIBILITY_CHANGED_EVENT,
  calendarVisibilityKey,
  dispatchCalendarVisibilityChanged,
  HIDDEN_CALENDARS_STORAGE_KEY,
  parseCalendarVisibilityKey,
  readHiddenCalendarKeysFromStorage,
  readM365GroupCalVisibilitySeededKeys,
  readSidebarHiddenCalendarKeysFromStorage,
  persistM365GroupCalVisibilitySeededKeys,
  SIDEBAR_HIDDEN_CALENDARS_STORAGE_KEY
} from '@/lib/calendar-visibility-storage'
import { sameStringSet } from '@/lib/same-string-set'

export interface UseCalendarShellCalendarVisibilityParams {
  calendarLinkedAccounts: ConnectedAccount[]
  msAccounts: ConnectedAccount[]
  calendarCollatorLocale: string
}

export function useCalendarShellCalendarVisibility({
  calendarLinkedAccounts,
  msAccounts,
  calendarCollatorLocale
}: UseCalendarShellCalendarVisibilityParams) {
  const [hiddenCalendarKeys, setHiddenCalendarKeys] = useState<Set<string>>(
    readHiddenCalendarKeysFromStorage
  )
  const [sidebarHiddenCalendarKeys, setSidebarHiddenCalendarKeys] = useState<Set<string>>(
    readSidebarHiddenCalendarKeysFromStorage
  )
  const [accountSidebarOpen, setAccountSidebarOpen] = useState<Record<string, boolean>>(
    parseAccountSidebarOpenFromStorage
  )
  const [accountGroupCalSidebarOpen, setAccountGroupCalSidebarOpen] = useState<
    Record<string, boolean>
  >(parseGroupCalSidebarOpenFromStorage)
  const [groupCalendarsLoading, setGroupCalendarsLoading] = useState<Record<string, boolean>>({})
  const [calendarsByAccount, setCalendarsByAccount] = useState<
    Record<string, CalendarGraphCalendarRow[]>
  >({})
  const calendarsLoadedRef = useRef<Set<string>>(new Set())
  const m365GroupCalFirstPageLoadedRef = useRef<Set<string>>(new Set())
  const [m365GroupCalPaging, setM365GroupCalPaging] = useState<
    Record<string, { total: number; nextOffset: number }>
  >({})

  const isAccountSidebarOpen = useCallback(
    (accountId: string) => accountSidebarOpen[accountId] !== false,
    [accountSidebarOpen]
  )

  const ensureCalendarsForAccount = useCallback(async (accountId: string) => {
    if (calendarsLoadedRef.current.has(accountId)) return
    calendarsLoadedRef.current.add(accountId)
    try {
      const rows = await window.mailClient.calendar.listCalendars({ accountId })
      setCalendarsByAccount((prev) => ({ ...prev, [accountId]: rows }))
    } catch {
      setCalendarsByAccount((prev) => ({ ...prev, [accountId]: [] }))
    }
  }, [])

  const reloadCalendarsForAccount = useCallback(
    async (accountId: string, opts?: { forceRefresh?: boolean }): Promise<void> => {
      try {
        const rows = await window.mailClient.calendar.listCalendars({
          accountId,
          forceRefresh: opts?.forceRefresh === true
        })
        setCalendarsByAccount((prev) => {
          const keepGroups = (prev[accountId] ?? []).filter((c) => c.calendarKind === 'm365Group')
          return { ...prev, [accountId]: [...rows, ...keepGroups] }
        })
      } catch {
        setCalendarsByAccount((prev) => ({ ...prev, [accountId]: [] }))
      }
    },
    []
  )

  const fetchMicrosoft365GroupCalendarsIfNeeded = useCallback(
    async (accountId: string): Promise<void> => {
      if (m365GroupCalFirstPageLoadedRef.current.has(accountId)) return
      setGroupCalendarsLoading((prev) => ({ ...prev, [accountId]: true }))
      try {
        const page = await window.mailClient.calendar.listMicrosoft365GroupCalendars({
          accountId,
          offset: 0,
          limit: 10
        })
        m365GroupCalFirstPageLoadedRef.current.add(accountId)
        setM365GroupCalPaging((prev) => ({
          ...prev,
          [accountId]: { total: page.totalGroups, nextOffset: page.offset + page.limit }
        }))
        setCalendarsByAccount((prev) => {
          const personal = (prev[accountId] ?? []).filter((c) => c.calendarKind !== 'm365Group')
          return { ...prev, [accountId]: [...personal, ...page.calendars] }
        })
      } catch (e) {
        console.warn('[CalendarShell] Gruppenkalender laden fehlgeschlagen:', accountId, e)
      } finally {
        setGroupCalendarsLoading((prev) => ({ ...prev, [accountId]: false }))
      }
    },
    []
  )

  const fetchMoreMicrosoft365GroupCalendars = useCallback(
    async (accountId: string, offset: number): Promise<void> => {
      setGroupCalendarsLoading((prev) => ({ ...prev, [accountId]: true }))
      try {
        const page = await window.mailClient.calendar.listMicrosoft365GroupCalendars({
          accountId,
          offset,
          limit: 10
        })
        setCalendarsByAccount((prev) => {
          const personal = (prev[accountId] ?? []).filter((c) => c.calendarKind !== 'm365Group')
          const existingGroups = (prev[accountId] ?? []).filter(
            (c) => c.calendarKind === 'm365Group'
          )
          const seen = new Set(existingGroups.map((c) => c.id))
          const merged = [...existingGroups]
          for (const c of page.calendars) {
            if (!seen.has(c.id)) {
              seen.add(c.id)
              merged.push(c)
            }
          }
          return { ...prev, [accountId]: [...personal, ...merged] }
        })
        setM365GroupCalPaging((prev) => ({
          ...prev,
          [accountId]: { total: page.totalGroups, nextOffset: page.offset + page.limit }
        }))
      } catch (e) {
        console.warn('[CalendarShell] Weitere Gruppenkalender fehlgeschlagen:', accountId, e)
      } finally {
        setGroupCalendarsLoading((prev) => ({ ...prev, [accountId]: false }))
      }
    },
    []
  )

  useEffect(() => {
    for (const a of calendarLinkedAccounts) {
      if (isAccountSidebarOpen(a.id)) void ensureCalendarsForAccount(a.id)
    }
  }, [calendarLinkedAccounts, accountSidebarOpen, ensureCalendarsForAccount, isAccountSidebarOpen])

  useEffect(() => {
    if (sidebarHiddenCalendarKeys.size === 0) return
    const accountIds = new Set<string>()
    const m365GroupAccountIds = new Set<string>()
    for (const key of sidebarHiddenCalendarKeys) {
      const parsed = parseCalendarVisibilityKey(key)
      if (!parsed) continue
      accountIds.add(parsed.accountId)
      if (parsed.graphCalendarId.startsWith(M365_GROUP_CALENDAR_ID_PREFIX)) {
        const acc = calendarLinkedAccounts.find((a) => a.id === parsed.accountId)
        if (acc?.provider === 'microsoft') m365GroupAccountIds.add(parsed.accountId)
      }
    }
    let cancelled = false
    for (const accountId of accountIds) {
      void reloadCalendarsForAccount(accountId)
    }
    for (const accountId of m365GroupAccountIds) {
      void (async (): Promise<void> => {
        const groupRows: CalendarGraphCalendarRow[] = []
        let offset = 0
        const limit = 50
        try {
          for (;;) {
            if (cancelled) return
            const page = await window.mailClient.calendar.listMicrosoft365GroupCalendars({
              accountId,
              offset,
              limit
            })
            groupRows.push(...page.calendars)
            if (!page.hasMore) break
            offset = page.offset + page.limit
          }
          if (cancelled) return
          setCalendarsByAccount((prev) => {
            const personal = (prev[accountId] ?? []).filter((c) => c.calendarKind !== 'm365Group')
            const seen = new Set(personal.map((c) => c.id))
            const merged = [...personal]
            for (const c of groupRows) {
              if (!seen.has(c.id)) {
                seen.add(c.id)
                merged.push(c)
              }
            }
            return { ...prev, [accountId]: merged }
          })
        } catch (e) {
          console.warn('[CalendarShell] Gruppenkalender fuer Wiederherstellung:', accountId, e)
        }
      })()
    }
    return (): void => {
      cancelled = true
    }
  }, [sidebarHiddenCalendarKeys, calendarLinkedAccounts, reloadCalendarsForAccount])

  useEffect(() => {
    if (calendarLinkedAccounts.length === 0) return
    setHiddenCalendarKeys((prev) => {
      const accIds = new Set(calendarLinkedAccounts.map((a) => a.id))
      let changed = false
      const next = new Set<string>()
      for (const k of prev) {
        const pipe = k.indexOf('|')
        const accId = pipe >= 0 ? k.slice(0, pipe) : k
        if (accIds.has(accId)) next.add(k)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [calendarLinkedAccounts])

  useEffect(() => {
    if (calendarLinkedAccounts.length === 0) return
    setSidebarHiddenCalendarKeys((prev) => {
      const accIds = new Set(calendarLinkedAccounts.map((a) => a.id))
      let changed = false
      const next = new Set<string>()
      for (const k of prev) {
        const parsed = parseCalendarVisibilityKey(k)
        if (!parsed) {
          changed = true
          continue
        }
        if (accIds.has(parsed.accountId)) next.add(k)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [calendarLinkedAccounts])

  useEffect(() => {
    if (calendarLinkedAccounts.length === 0) return
    setAccountSidebarOpen((prev) => {
      const accIds = new Set(calendarLinkedAccounts.map((a) => a.id))
      let changed = false
      const next: Record<string, boolean> = { ...prev }
      for (const id of Object.keys(next)) {
        if (!accIds.has(id)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setAccountGroupCalSidebarOpen((prev) => {
      const accIds = new Set(calendarLinkedAccounts.map((a) => a.id))
      let changed = false
      const next: Record<string, boolean> = { ...prev }
      for (const id of Object.keys(next)) {
        if (!accIds.has(id)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setGroupCalendarsLoading((prev) => {
      const accIds = new Set(calendarLinkedAccounts.map((a) => a.id))
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (!accIds.has(id)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setM365GroupCalPaging((prev) => {
      const accIds = new Set(calendarLinkedAccounts.map((a) => a.id))
      let changed = false
      const next: Record<string, { total: number; nextOffset: number }> = { ...prev }
      for (const id of Object.keys(next)) {
        if (!accIds.has(id)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    const accIds = new Set(calendarLinkedAccounts.map((a) => a.id))
    for (const id of [...m365GroupCalFirstPageLoadedRef.current]) {
      if (!accIds.has(id)) m365GroupCalFirstPageLoadedRef.current.delete(id)
    }
  }, [calendarLinkedAccounts])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        HIDDEN_CALENDARS_STORAGE_KEY,
        JSON.stringify(Array.from(hiddenCalendarKeys))
      )
    } catch {
      // ignore
    }
    dispatchCalendarVisibilityChanged()
  }, [hiddenCalendarKeys])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_HIDDEN_CALENDARS_STORAGE_KEY,
        JSON.stringify(Array.from(sidebarHiddenCalendarKeys))
      )
    } catch {
      // ignore
    }
    dispatchCalendarVisibilityChanged()
  }, [sidebarHiddenCalendarKeys])

  useEffect(() => {
    const onVis = (): void => {
      setHiddenCalendarKeys((prev) => {
        const next = readHiddenCalendarKeysFromStorage()
        return sameStringSet(prev, next) ? prev : next
      })
      setSidebarHiddenCalendarKeys((prev) => {
        const next = readSidebarHiddenCalendarKeysFromStorage()
        return sameStringSet(prev, next) ? prev : next
      })
    }
    window.addEventListener(CALENDAR_VISIBILITY_CHANGED_EVENT, onVis)
    return (): void => window.removeEventListener(CALENDAR_VISIBILITY_CHANGED_EVENT, onVis)
  }, [])

  useEffect(() => {
    persistAccountSidebarOpen(accountSidebarOpen)
  }, [accountSidebarOpen])

  useEffect(() => {
    persistGroupCalSidebarOpen(accountGroupCalSidebarOpen)
  }, [accountGroupCalSidebarOpen])

  useEffect(() => {
    const seeded = readM365GroupCalVisibilitySeededKeys()
    const nextSeeded = new Set(seeded)
    let seededChanged = false
    const toHide: string[] = []
    for (const a of msAccounts) {
      for (const cal of calendarsByAccount[a.id] ?? []) {
        if (cal.calendarKind !== 'm365Group') continue
        const vk = calendarVisibilityKey(a.id, cal.id)
        if (!nextSeeded.has(vk)) {
          nextSeeded.add(vk)
          seededChanged = true
          toHide.push(vk)
        }
      }
    }
    if (toHide.length > 0) {
      setHiddenCalendarKeys((prev) => {
        const next = new Set(prev)
        for (const vk of toHide) next.add(vk)
        return next
      })
    }
    if (seededChanged) persistM365GroupCalVisibilitySeededKeys(nextSeeded)
  }, [calendarsByAccount, msAccounts])

  const hideCalendarFromSidebar = useCallback((accountId: string, graphCalendarId: string): void => {
    const key = calendarVisibilityKey(accountId, graphCalendarId)
    setSidebarHiddenCalendarKeys((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    setHiddenCalendarKeys((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }, [])

  const restoreCalendarToSidebar = useCallback((visibilityKey: string): void => {
    setSidebarHiddenCalendarKeys((prev) => {
      const next = new Set(prev)
      next.delete(visibilityKey)
      return next
    })
    setHiddenCalendarKeys((prev) => {
      const next = new Set(prev)
      next.delete(visibilityKey)
      return next
    })
  }, [])

  const toggleCalendarVisibility = useCallback((accountId: string, graphCalendarId: string): void => {
    const key = calendarVisibilityKey(accountId, graphCalendarId)
    setHiddenCalendarKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const showAllCalendarsInView = useCallback((): void => {
    setHiddenCalendarKeys(new Set())
    setSidebarHiddenCalendarKeys(new Set())
  }, [])

  const calendarSidebarHiddenRestoreEntries = useMemo((): CalendarSidebarHiddenRestoreEntry[] => {
    const out: CalendarSidebarHiddenRestoreEntry[] = []
    for (const key of sidebarHiddenCalendarKeys) {
      const parsed = parseCalendarVisibilityKey(key)
      if (!parsed) continue
      const acc = calendarLinkedAccounts.find((a) => a.id === parsed.accountId)
      const rows = calendarsByAccount[parsed.accountId]
      const cal = rows?.find((c) => c.id === parsed.graphCalendarId)
      const accountLabel = acc?.displayName?.trim() || acc?.email || parsed.accountId
      const nameFromRow = cal?.name?.trim()
      const namePending =
        !nameFromRow &&
        (rows === undefined ||
          (parsed.graphCalendarId.startsWith(M365_GROUP_CALENDAR_ID_PREFIX) &&
            !rows.some((c) => c.id === parsed.graphCalendarId)))
      const calendarName = nameFromRow || (namePending ? '' : parsed.graphCalendarId)
      out.push({
        key,
        accountId: parsed.accountId,
        accountLabel,
        calendarName,
        namePending: namePending || undefined
      })
    }
    out.sort((a, b) => {
      const cmp = a.accountLabel.localeCompare(b.accountLabel, calendarCollatorLocale)
      if (cmp !== 0) return cmp
      return a.calendarName.localeCompare(b.calendarName, calendarCollatorLocale)
    })
    return out
  }, [
    sidebarHiddenCalendarKeys,
    calendarLinkedAccounts,
    calendarsByAccount,
    calendarCollatorLocale
  ])

  return {
    hiddenCalendarKeys,
    setHiddenCalendarKeys,
    sidebarHiddenCalendarKeys,
    setSidebarHiddenCalendarKeys,
    accountSidebarOpen,
    setAccountSidebarOpen,
    accountGroupCalSidebarOpen,
    setAccountGroupCalSidebarOpen,
    groupCalendarsLoading,
    calendarsByAccount,
    m365GroupCalPaging,
    isAccountSidebarOpen,
    ensureCalendarsForAccount,
    reloadCalendarsForAccount,
    fetchMicrosoft365GroupCalendarsIfNeeded,
    fetchMoreMicrosoft365GroupCalendars,
    hideCalendarFromSidebar,
    restoreCalendarToSidebar,
    toggleCalendarVisibility,
    showAllCalendarsInView,
    calendarSidebarHiddenRestoreEntries
  }
}
