import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MailListVirtualRow } from '@/lib/mail-list-arrange'

export function messageIdFromMailListRow(row: MailListVirtualRow): number {
  return row.kind === 'thread-head' ? row.thread.latestMessage.id : row.message.id
}

export function orderedMessageIdsFromRows(rows: readonly MailListVirtualRow[]): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const row of rows) {
    const id = messageIdFromMailListRow(row)
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/** Bereich zwischen Anker und Ziel in Listenreihenfolge (Windows Shift+Klick). */
export function rangeMessageIdsInListOrder(
  visibleIds: readonly number[],
  anchorId: number,
  toId: number
): number[] {
  const fromIdx = visibleIds.indexOf(anchorId)
  const toIdx = visibleIds.indexOf(toId)
  if (fromIdx < 0 || toIdx < 0) return [toId]
  const lo = Math.min(fromIdx, toIdx)
  const hi = Math.max(fromIdx, toIdx)
  return visibleIds.slice(lo, hi + 1)
}

export interface MailListBulkSelection {
  selectedIds: ReadonlySet<number>
  selectedCount: number
  /** Outlook-Modus: Checkboxen auf allen Zeilen (nach erster Checkbox oder Strg/Umschalt). */
  selectionUiActive: boolean
  isSelected: (id: number) => boolean
  toggle: (id: number) => void
  selectAllVisible: () => void
  clear: () => void
  handleRowPointerDown: (
    id: number,
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
  ) => void
  allVisibleSelected: boolean
  someVisibleSelected: boolean
}

export function useMailListBulkSelection(
  visibleRows: readonly MailListVirtualRow[],
  listScopeKey: string
): MailListBulkSelection {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(() => new Set())
  const [selectionUiActive, setSelectionUiActive] = useState(false)
  const rangeAnchorRef = useRef<number | null>(null)

  const visibleIds = useMemo(
    () => orderedMessageIdsFromRows(visibleRows),
    [visibleRows]
  )

  useEffect(() => {
    setSelectedIds(new Set())
    setSelectionUiActive(false)
    rangeAnchorRef.current = null
  }, [listScopeKey])

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(visibleIds)
      let changed = false
      const next = new Set<number>()
      for (const id of prev) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [visibleIds])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || selectedIds.size === 0) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return
      setSelectedIds(new Set())
      setSelectionUiActive(false)
      rangeAnchorRef.current = null
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [selectedIds.size])

  const toggle = useCallback((id: number): void => {
    setSelectionUiActive(true)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    rangeAnchorRef.current = id
  }, [])

  const selectRangeReplace = useCallback(
    (anchorId: number, toId: number): void => {
      const range = rangeMessageIdsInListOrder(visibleIds, anchorId, toId)
      setSelectedIds(new Set(range))
    },
    [visibleIds]
  )

  useEffect(() => {
    if (selectedIds.size === 0) setSelectionUiActive(false)
  }, [selectedIds.size])

  const handleRowPointerDown = useCallback(
    (id: number, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): void => {
      const extend = modifiers.ctrlKey || modifiers.metaKey
      if (modifiers.shiftKey || extend) {
        setSelectionUiActive(true)
      }
      if (modifiers.shiftKey) {
        const anchor = rangeAnchorRef.current ?? id
        if (extend) {
          const range = rangeMessageIdsInListOrder(visibleIds, anchor, id)
          setSelectedIds((prev) => {
            const next = new Set(prev)
            for (const rid of range) next.add(rid)
            return next
          })
        } else {
          selectRangeReplace(anchor, id)
        }
        return
      }
      if (extend) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        rangeAnchorRef.current = id
        return
      }
      rangeAnchorRef.current = id
    },
    [visibleIds, selectRangeReplace]
  )

  const selectAllVisible = useCallback((): void => {
    setSelectionUiActive(true)
    setSelectedIds(new Set(visibleIds))
    if (visibleIds.length > 0) rangeAnchorRef.current = visibleIds[0] ?? null
  }, [visibleIds])

  const clear = useCallback((): void => {
    setSelectedIds(new Set())
    setSelectionUiActive(false)
    rangeAnchorRef.current = null
  }, [])

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    selectionUiActive,
    isSelected: (id: number): boolean => selectedIds.has(id),
    toggle,
    selectAllVisible,
    clear,
    handleRowPointerDown,
    allVisibleSelected,
    someVisibleSelected
  }
}
